//! Open-folder support: the folder picker, a persisted allowlist of folders the user has
//! chosen, and list / read / write inside those folders only.
//!
//! The web layer can never name an arbitrary directory: a root is usable only if the user
//! picked it in the native dialog (now or in an earlier session, remembered in the app
//! data dir). Every relative path goes through `paths::join_relative` + `ensure_inside`.

use crate::paths::{ensure_inside, is_always_ignored, join_relative, to_relative};
use ignore::WalkBuilder;
use serde::Serialize;
use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

const MAX_LIST: usize = 100_000;
const MAX_TEXT_BYTES: u64 = 1_000_000;
const ALLOWLIST_FILE: &str = "folders.json";

#[derive(Default)]
pub struct FolderAccess {
    roots: Mutex<BTreeSet<PathBuf>>,
}

#[derive(Serialize)]
pub struct FolderInfo {
    root: String,
    name: String,
}

#[derive(Serialize)]
pub struct Entry {
    path: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ReadResult {
    Text { text: String },
    Binary,
    Missing,
}

fn allowlist_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(ALLOWLIST_FILE))
}

fn load_allowlist(app: &AppHandle) -> BTreeSet<PathBuf> {
    allowlist_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Vec<PathBuf>>(&s).ok())
        .map(|v| v.into_iter().collect())
        .unwrap_or_default()
}

fn remember(app: &AppHandle, access: &FolderAccess, root: &Path) -> Result<(), String> {
    let mut roots = access.roots.lock().map_err(|e| e.to_string())?;
    if roots.is_empty() {
        *roots = load_allowlist(app);
    }
    roots.insert(root.to_path_buf());
    let json = serde_json::to_string_pretty(&roots.iter().collect::<Vec<_>>()).map_err(|e| e.to_string())?;
    fs::write(allowlist_path(app)?, json).map_err(|e| e.to_string())
}

fn info(root: &Path) -> FolderInfo {
    FolderInfo {
        root: crate::paths::simplify_verbatim(root).to_string_lossy().into_owned(),
        name: root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "folder".into()),
    }
}

/// Canonical root, only if the user has picked it before.
fn allowed_root(app: &AppHandle, access: &FolderAccess, root: &str) -> Result<PathBuf, String> {
    let canonical = Path::new(root).canonicalize().map_err(|_| format!("Folder not found: {root}"))?;
    let mut roots = access.roots.lock().map_err(|e| e.to_string())?;
    if roots.is_empty() {
        *roots = load_allowlist(app);
    }
    if roots.contains(&canonical) {
        Ok(canonical)
    } else {
        Err("This folder has not been opened in Hydras. Use Open folder first.".into())
    }
}

fn resolve(app: &AppHandle, access: &FolderAccess, root: &str, relative: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = allowed_root(app, access, root)?;
    let target = join_relative(&root, relative).map_err(|e| e.to_string())?;
    ensure_inside(&root, &target).map_err(|e| e.to_string())?;
    Ok((root, target))
}

#[tauri::command]
pub async fn folder_pick(app: AppHandle, access: State<'_, FolderAccess>) -> Result<Option<FolderInfo>, String> {
    let picked = app.dialog().file().set_title("Open a folder in Hydras").blocking_pick_folder();
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    remember(&app, &access, &canonical)?;
    Ok(Some(info(&canonical)))
}

#[tauri::command]
pub fn folder_reopen(app: AppHandle, access: State<'_, FolderAccess>, root: String) -> Result<FolderInfo, String> {
    allowed_root(&app, &access, &root).map(|r| info(&r))
}

#[tauri::command]
pub async fn folder_list(app: AppHandle, access: State<'_, FolderAccess>, root: String) -> Result<Vec<Entry>, String> {
    let root = allowed_root(&app, &access, &root)?;
    Ok(list_files(&root))
}

/// Every file under `root`, honouring .gitignore and the always-ignored folders.
pub fn list_files(root: &Path) -> Vec<Entry> {
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .require_git(false)
        .filter_entry(|e| !crate::paths::ALWAYS_IGNORED.contains(&e.file_name().to_string_lossy().as_ref()))
        .build();
    let mut out = Vec::new();
    for item in walker.flatten() {
        if out.len() >= MAX_LIST {
            break;
        }
        if !item.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let Some(rel) = to_relative(root, item.path()) else { continue };
        if is_always_ignored(&rel) {
            continue;
        }
        let size = item.metadata().map(|m| m.len()).unwrap_or(0);
        out.push(Entry { path: rel, size });
    }
    out
}

/// Text if it is valid UTF-8 without NUL bytes and not too large; otherwise binary.
pub fn classify(bytes: Vec<u8>) -> ReadResult {
    if bytes.len() as u64 > MAX_TEXT_BYTES || bytes.iter().take(8192).any(|b| *b == 0) {
        return ReadResult::Binary;
    }
    match String::from_utf8(bytes) {
        Ok(mut text) => {
            if text.starts_with('\u{feff}') {
                text.remove(0);
            }
            ReadResult::Text { text }
        }
        Err(_) => ReadResult::Binary,
    }
}

#[tauri::command]
pub async fn folder_read(app: AppHandle, access: State<'_, FolderAccess>, root: String, path: String) -> Result<ReadResult, String> {
    let (_, target) = resolve(&app, &access, &root, &path)?;
    read_file(&target)
}

pub fn read_file(target: &Path) -> Result<ReadResult, String> {
    match fs::read(target) {
        Ok(bytes) => Ok(classify(bytes)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ReadResult::Missing),
        Err(e) => Err(e.to_string()),
    }
}

/// Atomic write: temp file in the same directory, then rename over the target.
#[tauri::command]
pub async fn folder_write(app: AppHandle, access: State<'_, FolderAccess>, root: String, path: String, text: String) -> Result<(), String> {
    let (root, target) = resolve(&app, &access, &root, &path)?;
    write_file(&root, &target, &text)
}

pub fn write_file(root: &Path, target: &Path, text: &str) -> Result<(), String> {
    let parent = target.parent().ok_or("invalid path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    ensure_inside(root, parent).map_err(|e| e.to_string())?;
    let tmp = parent.join(format!(".{}.hydras-tmp", target.file_name().map(|n| n.to_string_lossy()).unwrap_or_default()));
    {
        let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        file.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

pub fn canonical_allowed_root(app: &AppHandle, access: &FolderAccess, root: &str) -> Result<PathBuf, String> {
    allowed_root(app, access, root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_text_binary_and_bom() {
        assert!(matches!(classify(b"hello".to_vec()), ReadResult::Text { .. }));
        assert!(matches!(classify(vec![0x89, b'P', b'N', b'G', 0, 1]), ReadResult::Binary));
        assert!(matches!(classify(vec![0xff, 0xfe, 0xfd]), ReadResult::Binary));
        match classify("\u{feff}bom".as_bytes().to_vec()) {
            ReadResult::Text { text } => assert_eq!(text, "bom"),
            _ => panic!("expected text"),
        }
    }

    fn temp_project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hydras-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::create_dir_all(dir.join("node_modules").join("pkg")).unwrap();
        fs::create_dir_all(dir.join("logs")).unwrap();
        fs::write(dir.join(".gitignore"), "logs/\n*.secret\n").unwrap();
        fs::write(dir.join("README.md"), "# demo\n").unwrap();
        fs::write(dir.join("src").join("main.ts"), "run()\n").unwrap();
        fs::write(dir.join("node_modules").join("pkg").join("index.js"), "x").unwrap();
        fs::write(dir.join("logs").join("today.log"), "noise").unwrap();
        fs::write(dir.join("api.secret"), "k").unwrap();
        dir.canonicalize().unwrap()
    }

    #[test]
    fn lists_a_real_project_respecting_gitignore_and_dependency_folders() {
        let root = temp_project("list");
        let mut paths: Vec<String> = list_files(&root).into_iter().map(|e| e.path).collect();
        paths.sort();
        assert_eq!(paths, vec![".gitignore", "README.md", "src/main.ts"]);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_atomically_creating_folders_and_reads_back() {
        let root = temp_project("write");
        let target = crate::paths::join_relative(&root, "src/new/deep.ts").unwrap();
        write_file(&root, &target, "export const x = 1\n").unwrap();
        match read_file(&target).unwrap() {
            ReadResult::Text { text } => assert_eq!(text, "export const x = 1\n"),
            _ => panic!("expected text"),
        }
        let leftovers: Vec<_> = fs::read_dir(target.parent().unwrap())
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().ends_with(".hydras-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temp file left behind");
        assert!(matches!(read_file(&root.join("missing.ts")).unwrap(), ReadResult::Missing));
        let _ = fs::remove_dir_all(&root);
    }
}
