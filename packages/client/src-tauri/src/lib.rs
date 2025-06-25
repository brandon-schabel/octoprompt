use tauri::{Manager, Emitter};
use tauri_plugin_shell::{ShellExt, process::CommandEvent};
use std::sync::Mutex;

// Store the child process handle globally so we can kill it on app exit
struct ServerState {
    child: Option<tauri_plugin_shell::process::CommandChild>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_octoprompt_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<ServerState>>
) -> Result<String, String> {
    let shell = app.shell();
    
    // Check if server is already running
    {
        let state_guard = state.lock().unwrap();
        if state_guard.child.is_some() {
            return Ok("OctoPrompt server is already running".to_string());
        }
    }
    
    let (mut rx, child) = shell
        .sidecar("octoprompt-server")
        .map_err(|e| e.to_string())?
        .args(["--port", "3147"])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Store the child process
    {
        let mut state_guard = state.lock().unwrap();
        state_guard.child = Some(child);
    }

    let app_handle = app.clone();
    
    // Handle process output in background
    tauri::async_runtime::spawn(async move {
        let mut server_ready = false;
        
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    println!("Server: {}", line_str);
                    
                    // Check if server is ready
                    if !server_ready && (line_str.contains("Server running") || line_str.contains("Listening on")) {
                        server_ready = true;
                        // Emit event to frontend
                        app_handle.emit("octoprompt-server-ready", ()).unwrap();
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("Server error: {}", line_str);
                }
                CommandEvent::Terminated(payload) => {
                    println!("Server terminated with code: {:?}", payload.code);
                    // Emit event to frontend
                    app_handle.emit("octoprompt-server-terminated", payload.code).unwrap();
                    break;
                }
                _ => {}
            }
        }
    });

    Ok("OctoPrompt server starting on port 3147".to_string())
}

#[tauri::command]
async fn stop_octoprompt_server(
    state: tauri::State<'_, Mutex<ServerState>>
) -> Result<String, String> {
    let mut state_guard = state.lock().unwrap();
    
    if let Some(child) = state_guard.child.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("OctoPrompt server stopped".to_string())
    } else {
        Ok("OctoPrompt server was not running".to_string())
    }
}

#[tauri::command]
async fn check_server_status() -> Result<bool, String> {
    // Simple health check by trying to connect to the server
    match reqwest::get("http://localhost:3147/api/health").await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_octoprompt_server,
            stop_octoprompt_server,
            check_server_status
        ])
        .manage(Mutex::new(ServerState { child: None }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
