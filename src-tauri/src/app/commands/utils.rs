use crate::app::dir_state::OpenDirectoryState;
use std::sync::Arc;
use tauri::State;

/// 获取启动时传入的目录路径（一次性读取后清空）
#[tauri::command]
pub fn get_cli_directory(
    window: tauri::Window,
    state: State<'_, OpenDirectoryState>,
) -> Option<Arc<str>> {
    state.pending().pin().remove(window.label()).cloned()
}

/// 新建桌面窗口
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn open_new_window(app: tauri::AppHandle, directory: Option<String>) {
    crate::app::create_new_window(&app, directory);
}

/// 桌面窗口前端首帧完成后，通知 Rust 显示真实窗口并关闭 loading 窗口
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn desktop_window_ready(window: tauri::Window) -> Result<(), String> {
    crate::app::mark_window_ready(&window).map_err(|err| err.to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct PiAgentConnection {
    pub port: u16,
    pub token: String,
}

#[tauri::command]
pub fn get_pi_agent_connection() -> Option<PiAgentConnection> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)?;
    let conn_file = home.join(".pi").join("agent").join("piagentui-port.json");
    if !conn_file.exists() {
        return None;
    }
    let file = std::fs::File::open(conn_file).ok()?;
    serde_json::from_reader(file).ok()
}
