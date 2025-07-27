use tauri::Emitter;
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
async fn start_promptliano_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<ServerState>>
) -> Result<String, String> {
    println!("[Tauri] start_promptliano_server called");
    let shell = app.shell();
    
    // Check if server is already running
    {
        let state_guard = state.lock().unwrap();
        if state_guard.child.is_some() {
            println!("[Tauri] Server already running");
            return Ok("Promptliano server is already running".to_string());
        }
    }
    
    println!("[Tauri] Spawning server sidecar...");
    let (mut rx, child) = shell
        .sidecar("promptliano-server")
        .map_err(|e| {
            eprintln!("[Tauri] Failed to spawn sidecar: {}", e);
            e.to_string()
        })?
        .args(["--port", "3147"])
        .spawn()
        .map_err(|e| {
            eprintln!("[Tauri] Failed to spawn process: {}", e);
            e.to_string()
        })?;
    
    println!("[Tauri] Sidecar spawned successfully");

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
                    println!("[Tauri] Server stdout: {}", line_str);
                    
                    // Check if server is ready - look for multiple patterns
                    if !server_ready && (
                        line_str.contains("Server running") || 
                        line_str.contains("Listening on") ||
                        line_str.contains("[Server] Server running at")
                    ) {
                        println!("[Tauri] Server ready detected!");
                        server_ready = true;
                        // Emit event to frontend
                        app_handle.emit("promptliano-server-ready", ()).unwrap();
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("[Tauri] Server stderr: {}", line_str);
                }
                CommandEvent::Terminated(payload) => {
                    println!("[Tauri] Server terminated with code: {:?}", payload.code);
                    // Emit event to frontend
                    app_handle.emit("promptliano-server-terminated", payload.code).unwrap();
                    break;
                }
                _ => {}
            }
        }
    });

    Ok("Promptliano server starting on port 3147".to_string())
}

#[tauri::command]
async fn stop_promptliano_server(
    state: tauri::State<'_, Mutex<ServerState>>
) -> Result<String, String> {
    let mut state_guard = state.lock().unwrap();
    
    if let Some(child) = state_guard.child.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Promptliano server stopped".to_string())
    } else {
        Ok("Promptliano server was not running".to_string())
    }
}

#[tauri::command]
async fn check_server_status() -> Result<bool, String> {
    println!("[Tauri] Checking server status...");
    // Simple health check by trying to connect to the server
    match reqwest::get("http://localhost:3147/api/health").await {
        Ok(response) => {
            let status = response.status().is_success();
            println!("[Tauri] Server health check: {}", if status { "OK" } else { "Failed" });
            Ok(status)
        },
        Err(e) => {
            println!("[Tauri] Server health check error: {}", e);
            Ok(false)
        },
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
            start_promptliano_server,
            stop_promptliano_server,
            check_server_status
        ])
        .manage(Mutex::new(ServerState { child: None }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
