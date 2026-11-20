use std::{process::{Child, Command}, sync::Mutex};
use tauri::Manager;
#[derive(Default)]
pub struct LanRuntime(pub Mutex<Option<Child>>);
impl LanRuntime {
    pub fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() { if let Some(mut child) = guard.take() { let _ = child.kill(); let _ = child.wait(); } }
    }
}
pub fn start(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let root = app.path().resource_dir()?.join("lan");
    if !root.join("node.exe").exists() { return Ok(()); }
    let data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data)?;
    let mut command = Command::new(root.join("node.exe"));
    command.arg("web.mjs").current_dir(&root).env("SQLITE_PATH", data.join("hydras.sqlite"));
    #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
    let child = command.spawn()?;
    *app.state::<LanRuntime>().0.lock().unwrap() = Some(child);
    Ok(())
}
