use std::process::Command;
use tauri::Manager; // Wichtig für den Zugriff auf App-Pfade

use tauri::path::BaseDirectory;

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

#[tauri::command]
fn schreibe_bild_metdaten(
    app_handle: tauri::AppHandle,
    dateipfad: String,
    filename: String,
    caption: String,
    description: String,
    keywords: String,
    creator: String,
    copyright: String,
    editor: String,
    gps: String
) -> Result<String, String> {
    // 1. Pfad zur mitgelieferten .ExifTool_config auflösen
    let config_path = app_handle.path()
        .resolve(".ExifTool_config", BaseDirectory::Resource)
        .map_err(|e| format!("Konfigurationsfehler: {}", e))?;

    // 2. Den ExifTool-Schreibbefehl vorbereiten
    let mut cmd = Command::new("exiftool");
    cmd.arg("-config").arg(config_path);
    cmd.arg("-m");
    cmd.arg("-IPTCDigest").arg("new");
    // Wichtige Parameter für sicheres Überschreiben im UTF-8-Standard
    cmd.arg("-charset").arg("utf8");
    cmd.arg("-overwrite_original"); // Überschreibt die Datei direkt (keine _original Backups)
    // Die Tags aus dem Formular zuweisen
    cmd.arg(format!("-FileName={}", filename));
    cmd.arg(format!("-CMB_Caption={}", caption));
    cmd.arg(format!("-MWG:Description={}", description));
    cmd.arg(format!("-MWG:Creator={}", creator));
    cmd.arg(format!("-MWG:Copyright={}", copyright));
    cmd.arg(format!("-CMB_Editor={}", editor));
    cmd.arg(format!("-GPSPosition={}", gps));
    // Zum Schluss das Zielbild anhängen
    cmd.arg(&dateipfad);

    // 3. Befehl ausführen
    let output = cmd.output().map_err(|e| format!("Schreibfehler: {}", e))?;

    if output.status.success() {
        Ok("Metadaten erfolgreich gespeichert und in UTF-8 konvertiert!".to_string())
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
