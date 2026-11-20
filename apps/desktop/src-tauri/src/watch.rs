//! Watch an opened folder and report changed relative paths to the web layer.
//!
//! Events are batched for a short window (editors and git often touch a file several times
//! in a row) and filtered with the same rules as the initial listing: the folder's root
//! .gitignore plus the always-ignored directories. Our own atomic-write temp files are
//! ignored too.

use crate::folders::{canonical_allowed_root, FolderAccess};
use crate::paths::{is_always_ignored, to_relative};
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

const BATCH_WINDOW: Duration = Duration::from_millis(150);

#[derive(Default)]
pub struct Watchers {
    next_id: AtomicU32,
    active: Mutex<HashMap<u32, RecommendedWatcher>>,
}

fn root_gitignore(root: &Path) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    let _ = builder.add(root.join(".gitignore"));
    builder.build().unwrap_or_else(|_| Gitignore::empty())
}

fn keep(root: &Path, gitignore: &Gitignore, path: &Path) -> Option<String> {
    let rel = to_relative(root, path)?;
    if is_always_ignored(&rel) || rel.ends_with(".hydras-tmp") {
        return None;
    }
    if gitignore.matched_path_or_any_parents(path, false).is_ignore() {
        return None;
    }
    Some(rel)
}

fn forward_batches(root: PathBuf, rx: mpsc::Receiver<Vec<PathBuf>>, out: Channel<Vec<String>>) {
    let gitignore = root_gitignore(&root);
    while let Ok(first) = rx.recv() {
        let mut batch: BTreeSet<String> = BTreeSet::new();
        let mut absorb = |paths: Vec<PathBuf>| {
            for path in paths {
                if let Some(rel) = keep(&root, &gitignore, &path) {
                    batch.insert(rel);
                }
            }
        };
        absorb(first);
        while let Ok(more) = rx.recv_timeout(BATCH_WINDOW) {
            absorb(more);
        }
        if !batch.is_empty() && out.send(batch.into_iter().collect()).is_err() {
            break; // webview went away
        }
    }
}

#[tauri::command]
pub fn folder_watch(
    app: AppHandle,
    access: State<'_, FolderAccess>,
    watchers: State<'_, Watchers>,
    root: String,
    on_change: Channel<Vec<String>>,
) -> Result<u32, String> {
    let root = canonical_allowed_root(&app, &access, &root)?;
    let (tx, rx) = mpsc::channel::<Vec<PathBuf>>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let _ = tx.send(event.paths);
        }
    })
    .map_err(|e| e.to_string())?;
    watcher.watch(&root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    let thread_root = root.clone();
    std::thread::spawn(move || forward_batches(thread_root, rx, on_change));

    let id = watchers.next_id.fetch_add(1, Ordering::Relaxed);
    watchers.active.lock().map_err(|e| e.to_string())?.insert(id, watcher);
    Ok(id)
}

/// Dropping the watcher closes the event channel, which ends the forwarding thread.
#[tauri::command]
pub fn folder_unwatch(watchers: State<'_, Watchers>, id: u32) -> Result<(), String> {
    watchers.active.lock().map_err(|e| e.to_string())?.remove(&id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_ignored_and_temp_paths() {
        let root = std::env::temp_dir().join("hydras-watch-test");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(".gitignore"), "*.log\nsecret/\n").unwrap();
        let gi = root_gitignore(&root);

        assert_eq!(keep(&root, &gi, &root.join("src").join("a.ts")).as_deref(), Some("src/a.ts"));
        assert_eq!(keep(&root, &gi, &root.join("debug.log")), None);
        assert_eq!(keep(&root, &gi, &root.join("secret").join("k.txt")), None);
        assert_eq!(keep(&root, &gi, &root.join("node_modules").join("x.js")), None);
        assert_eq!(keep(&root, &gi, &root.join(".a.ts.hydras-tmp")), None);
    }
}
