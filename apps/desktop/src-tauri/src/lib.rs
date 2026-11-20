//! Hydras desktop shell.
//!
//! One native window around the web app (apps/web), plus the things a browser can't do:
//! open a real folder on disk (picker, read/write, watch) and run real terminals.
//! All collaboration logic stays in the web code.

mod folders;
mod paths;
mod terminal;
mod watch;

use tauri::{Manager, RunEvent};

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(folders::FolderAccess::default())
        .manage(watch::Watchers::default())
        .manage(terminal::Terminals::default())
        .invoke_handler(tauri::generate_handler![
            folders::folder_pick,
            folders::folder_reopen,
            folders::folder_list,
            folders::folder_read,
            folders::folder_write,
            watch::folder_watch,
            watch::folder_unwatch,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
        ])
        .build(tauri::generate_context!())
        .expect("failed to start Hydras");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<terminal::Terminals>().kill_all();
        }
    });
}
