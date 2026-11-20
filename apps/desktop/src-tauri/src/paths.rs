//! Path safety for everything the web layer asks the shell to read or write.
//!
//! The web layer only ever sends paths *relative* to a folder the user picked. This module
//! turns them into absolute paths and refuses anything that could leave that folder:
//! absolute paths, `..`, drive prefixes, and symlinks that resolve outside the root.

use std::path::{Component, Path, PathBuf};

/// Directories never imported or watched, even without a .gitignore.
pub const ALWAYS_IGNORED: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
];

#[derive(Debug, PartialEq, Eq)]
pub enum PathError {
    Empty,
    NotRelative,
    Escapes,
}

impl std::fmt::Display for PathError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PathError::Empty => write!(f, "path is empty"),
            PathError::NotRelative => write!(f, "path must be relative to the project folder"),
            PathError::Escapes => write!(f, "path points outside the project folder"),
        }
    }
}

/// Validate a "/"-separated relative path and join it onto `root` (no filesystem access).
pub fn join_relative(root: &Path, relative: &str) -> Result<PathBuf, PathError> {
    if relative.trim().is_empty() {
        return Err(PathError::Empty);
    }
    let rel = Path::new(relative);
    let mut out = root.to_path_buf();
    for component in rel.components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir => return Err(PathError::Escapes),
            Component::RootDir | Component::Prefix(_) => return Err(PathError::NotRelative),
        }
    }
    Ok(out)
}

/// After the target (or its nearest existing ancestor) exists, make sure symlinks did not
/// carry it outside the canonical root.
pub fn ensure_inside(canonical_root: &Path, target: &Path) -> Result<(), PathError> {
    let mut probe = target.to_path_buf();
    loop {
        if let Ok(real) = probe.canonicalize() {
            return if real.starts_with(canonical_root) { Ok(()) } else { Err(PathError::Escapes) };
        }
        if !probe.pop() {
            return Err(PathError::Escapes);
        }
    }
}

/// Relative "/"-separated path of `absolute` under `root`, if it is inside.
pub fn to_relative(root: &Path, absolute: &Path) -> Option<String> {
    let rel = absolute.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(p) => Some(p.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    if parts.is_empty() { None } else { Some(parts.join("/")) }
}

/// `canonicalize` on Windows returns verbatim paths (`\\?\C:\work`). Shells and people
/// expect `C:\work`, so strip the prefix when the result is an ordinary drive or UNC path.
pub fn simplify_verbatim(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(unc) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{unc}"));
    }
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        let bytes = rest.as_bytes();
        if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
            return PathBuf::from(rest);
        }
    }
    path.to_path_buf()
}

pub fn is_always_ignored(relative: &str) -> bool {
    relative.split('/').any(|part| ALWAYS_IGNORED.contains(&part))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_plain_relative_paths() {
        let root = Path::new("/work/app");
        assert_eq!(join_relative(root, "src/main.ts").unwrap(), root.join("src").join("main.ts"));
        assert_eq!(join_relative(root, "./a.ts").unwrap(), root.join("a.ts"));
    }

    #[test]
    fn refuses_escapes_and_absolute_paths() {
        let root = Path::new("/work/app");
        assert_eq!(join_relative(root, "../secret"), Err(PathError::Escapes));
        assert_eq!(join_relative(root, "src/../../x"), Err(PathError::Escapes));
        assert_eq!(join_relative(root, "/etc/passwd"), Err(PathError::NotRelative));
        assert_eq!(join_relative(root, "  "), Err(PathError::Empty));
    }

    #[test]
    fn converts_back_to_relative() {
        let root = Path::new("/work/app");
        assert_eq!(to_relative(root, &root.join("src").join("a.ts")).as_deref(), Some("src/a.ts"));
        assert_eq!(to_relative(root, Path::new("/elsewhere/a.ts")), None);
    }

    #[test]
    fn simplifies_windows_verbatim_paths() {
        assert_eq!(simplify_verbatim(Path::new(r"\\?\C:\work\app")), PathBuf::from(r"C:\work\app"));
        assert_eq!(simplify_verbatim(Path::new(r"\\?\UNC\srv\share")), PathBuf::from(r"\\srv\share"));
        assert_eq!(simplify_verbatim(Path::new("/home/me/app")), PathBuf::from("/home/me/app"));
    }

    #[test]
    fn ignores_dependency_and_build_folders() {
        assert!(is_always_ignored("node_modules/react/index.js"));
        assert!(is_always_ignored("apps/web/dist/index.html"));
        assert!(!is_always_ignored("src/distance.ts"));
    }

    #[test]
    fn detects_symlink_style_escape_via_canonical_check() {
        let dir = std::env::temp_dir();
        let root = dir.canonicalize().unwrap();
        assert!(ensure_inside(&root, &root.join("new-file-that-does-not-exist.txt")).is_ok());
        let outside = root.parent().unwrap_or(&root).to_path_buf();
        if outside != root {
            assert_eq!(ensure_inside(&root, &outside), Err(PathError::Escapes));
        }
    }
}
