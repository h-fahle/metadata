use std::process::Command;
use tauri::Manager; // Wichtig für den Zugriff auf App-Pfade

#[tauri::command]
fn lese_bild_metdaten(app_handle: tauri::AppHandle, dateipfad: String) -> Result<String, String> {
    // 1. Wir holen uns den Pfad zum internen Ressourcen-Ordner der installierten App
    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Ressourcen-Ordner nicht gefunden: {}", e))?;
    
    // 2. Wir bauen den exakten Pfad zur mitgelieferten Konfigurationsdatei
    let config_path = resource_dir.join(".ExifTool_config");

    // 3. ExifTool-Prozess mit dem exakten Ressourcen-Pfad starten
    let output = Command::new("exiftool")
        .arg("-config")
        .arg(config_path)
        .arg("-fast2")
        .arg("-d")
        .arg("%d.%m.%Y")
        .arg("-c")
        .arg("%-.6f")
        .arg("-json")
        .arg("-FileName")
        .arg("-ImageSize")
        .arg("-CMB_Caption")
        .arg("-CMB_Editor")
        .arg("-MWG:all")
        .arg("-GPSPosition")
        .arg(&dateipfad)
        .output()
        .map_err(|e| format!("ExifTool-Fehler: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Wir registrieren den neuen Befehl
        .invoke_handler(tauri::generate_handler![lese_bild_metdaten])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
