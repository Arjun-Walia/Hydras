//! Real terminals: a shell on a native pseudo-terminal (ConPTY on Windows, openpty on
//! macOS/Linux), streamed to xterm.js in the web layer through IPC channels.
//!
//! The shell starts in the opened project folder (only folders the user picked are
//! allowed) or in the home directory. Output is forwarded as UTF-8 text; multi-byte
//! characters split across reads are held back until complete.

use crate::folders::{canonical_allowed_root, FolderAccess};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct Terminals {
    next_id: AtomicU32,
    sessions: Arc<Mutex<HashMap<u32, Session>>>,
}

impl Terminals {
    pub fn kill_all(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, mut session) in sessions.drain() {
                let _ = session.child.kill();
            }
        }
    }
}

/// Split `pending` into the longest prefix that is complete UTF-8 (invalid bytes are
/// replaced) and keep an incomplete trailing sequence for the next read.
pub fn take_utf8(pending: &mut Vec<u8>) -> String {
    let mut out = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(text) => {
                out.push_str(text);
                pending.clear();
                return out;
            }
            Err(e) => {
                let valid = e.valid_up_to();
                out.push_str(std::str::from_utf8(&pending[..valid]).unwrap_or_default());
                match e.error_len() {
                    Some(bad) => {
                        out.push('\u{fffd}');
                        pending.drain(..valid + bad);
                    }
                    None => {
                        pending.drain(..valid);
                        return out;
                    }
                }
            }
        }
    }
}

fn find_on_path(exe: &str) -> Option<PathBuf> {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).map(|dir| dir.join(exe)).find(|p| p.is_file()))
        .flatten()
}

fn default_shell() -> CommandBuilder {
    if cfg!(windows) {
        let shell = find_on_path("pwsh.exe").unwrap_or_else(|| PathBuf::from("powershell.exe"));
        let mut cmd = CommandBuilder::new(shell);
        cmd.arg("-NoLogo");
        cmd
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
        let mut cmd = CommandBuilder::new(shell);
        cmd.arg("-l");
        cmd
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(2), cols: cols.max(10), pixel_width: 0, pixel_height: 0 }
}

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    access: State<'_, FolderAccess>,
    terminals: State<'_, Terminals>,
    root: Option<String>,
    cols: u16,
    rows: u16,
    on_data: Channel<String>,
    on_exit: Channel<i32>,
) -> Result<u32, String> {
    let cwd = match root {
        Some(root) => crate::paths::simplify_verbatim(&canonical_allowed_root(&app, &access, &root)?),
        None => app.path().home_dir().map_err(|e| e.to_string())?,
    };

    let pair = native_pty_system().openpty(pty_size(cols, rows)).map_err(|e| e.to_string())?;
    let mut cmd = default_shell();
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "Hydras");
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = terminals.next_id.fetch_add(1, Ordering::Relaxed);
    terminals
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, Session { master: pair.master, writer, child });

    let sessions = Arc::clone(&terminals.sessions);
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut pending = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let text = take_utf8(&mut pending);
                    if !text.is_empty() && on_data.send(text).is_err() {
                        break;
                    }
                }
            }
        }
        let code = sessions
            .lock()
            .ok()
            .and_then(|mut s| s.remove(&id))
            .and_then(|mut session| session.child.wait().ok())
            .map(|status| status.exit_code() as i32)
            .unwrap_or(-1);
        let _ = on_exit.send(code);
    });

    Ok(id)
}

#[tauri::command]
pub fn terminal_write(terminals: State<'_, Terminals>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = terminals.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&id).ok_or("terminal has exited")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_resize(terminals: State<'_, Terminals>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = terminals.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&id).ok_or("terminal has exited")?;
    session.master.resize(pty_size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_kill(terminals: State<'_, Terminals>, id: u32) -> Result<(), String> {
    let mut sessions = terminals.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get_mut(&id) {
        session.child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn holds_back_split_multibyte_characters() {
        let bytes = "héllo ✓".as_bytes();
        let split = bytes.len() - 1; // cut inside the 3-byte check mark
        let mut pending = bytes[..split].to_vec();
        assert_eq!(take_utf8(&mut pending), "héllo ");
        pending.extend_from_slice(&bytes[split..]);
        assert_eq!(take_utf8(&mut pending), "✓");
        assert!(pending.is_empty());
    }

    /// Spawns a real shell on a real PTY (ConPTY on Windows) and reads its output.
    #[test]
    fn runs_a_real_command_on_a_pty() {
        let pair = native_pty_system().openpty(pty_size(80, 24)).unwrap();
        let mut cmd = if cfg!(windows) {
            let mut c = CommandBuilder::new("cmd.exe");
            c.args(["/C", "echo hydras-pty-ok"]);
            c
        } else {
            let mut c = CommandBuilder::new("/bin/sh");
            c.args(["-c", "echo hydras-pty-ok"]);
            c
        };
        cmd.cwd(std::env::temp_dir());
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut writer = pair.master.take_writer().unwrap();

        let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 || tx.send(buf[..n].to_vec()).is_err() {
                    break;
                }
            }
        });

        // Act like a terminal: ConPTY asks for the cursor position (ESC[6n) and waits for
        // the answer before it prints anything. xterm.js answers this in the real app.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
        let mut output = String::new();
        let mut answered = false;
        while !output.contains("hydras-pty-ok") && std::time::Instant::now() < deadline {
            if let Ok(chunk) = rx.recv_timeout(std::time::Duration::from_millis(200)) {
                output.push_str(&String::from_utf8_lossy(&chunk));
            }
            if !answered && output.contains("\x1b[6n") {
                writer.write_all(b"\x1b[1;1R").unwrap();
                writer.flush().unwrap();
                answered = true;
            }
        }
        assert!(output.contains("hydras-pty-ok"), "unexpected output: {output:?}");
        let _ = child.wait();
    }

    #[test]
    fn replaces_invalid_bytes_and_keeps_going() {
        let mut pending = vec![b'a', 0xff, b'b'];
        assert_eq!(take_utf8(&mut pending), "a\u{fffd}b");
    }
}
