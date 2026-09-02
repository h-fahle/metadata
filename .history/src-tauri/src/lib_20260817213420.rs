use base64::{engine::general_purpose, Engine as _};
use std::process::Command;
use tauri::path::BaseDirectory;
use tauri::Manager; // Wichtig für den Zugriff auf App-Pfade // für den tiff-Wandler

#[tauri::command]
fn hole_vorschaubild(dateipfad: String) -> Result<String, String> {
    let pfad = std::path::Path::new(&dateipfad);
    let extension = pfad
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 1. Für TIFF und TIF nutzen wir die im RAM kompilierte Bildbibliothek
    if extension == "tiff" || extension == "tif" {
        // Bild von der Festplatte öffnen
        let img = image::open(pfad).map_err(|e| format!("TIFF-Ladefehler: {}", e))?;

        // Einen leeren Speicherpuffer im RAM anlegen
        let mut jpeg_puffer = std::io::Cursor::new(Vec::new());

        // Das Bild als komprimiertes JPEG in den RAM-Puffer schreiben
        img.write_to(&mut jpeg_puffer, image::ImageFormat::Jpeg)
            .map_err(|e| format!("Konvertierungsfehler: {}", e))?;

        // Das fertige RAM-Bild in einen Web-sicheren Text-String (Base64) umwandeln
        let base64_string = general_purpose::STANDARD.encode(jpeg_puffer.into_inner());

        // Als fertiges Daten-Paket ans HTML-Frontend schicken
        return Ok(format!("data:image/jpeg;base64,{}", base64_string));
    }

    // 2. Für alle anderen Formate (jpg, jpeg, png), die WebKit von Haus aus kann
    Ok("STANDARD".to_string())
}

#[tauri::command]
fn lese_bild_metdaten(app_handle: tauri::AppHandle, dateipfad: String) -> Result<String, String> {
    // 1. Wir holen uns den Pfad zum internen Ressourcen-Ordner der installierten App
    let resource_dir = app_handle
        .path()
        .resource_dir()
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
    gps: String,
) -> Result<String, String> {
    // 1. Pfad zur mitgelieferten .ExifTool_config auflösen
    let config_path = app_handle
        .path()
        .resolve(".ExifTool_config", BaseDirectory::Resource)
        .map_err(|e| format!("Konfigurationsfehler: {}", e))?;

    // 2. Den ExifTool-Schreibbefehl vorbereiten
    let mut cmd = Command::new("exiftool");
    cmd.arg("-config");
    cmd.arg(config_path);
    cmd.arg("-m");
    cmd.arg("-IPTCDigest=new");
    // Wichtige Parameter für sicheres Überschreiben im UTF-8-Standard
    cmd.arg("-charset");
    cmd.arg("utf8");
    cmd.arg("-overwrite_original"); // Überschreibt die Datei direkt (keine _original Backups)
    cmd.arg("-sep");
    cmd.arg(","); // Definiert das Komma als Trennzeichen für Keywords
                  // Die Tags aus dem Formular zuweisen
    cmd.arg(format!("-FileName={}", filename));
    cmd.arg(format!("-CMB_Caption_Set={}", caption));
    cmd.arg(format!("-MWG:Description={}", description));
    cmd.arg(format!("-MWG:Keywords={}", keywords));
    cmd.arg(format!("-MWG:Creator={}", creator));
    cmd.arg(format!("-MWG:Copyright={}", copyright));
    cmd.arg(format!("-CMB_Editor_Set={}", editor));
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


#[tauri::command]
fn oeffne_maps_browser(app_handle: tauri::AppHandle, gps_string: String) -> Result<(), String> {
    let url = format!("https://www.google.com/maps/search/?api=1&query={}", gps_string);
    if gps_string.trim().is_empty() {
        let url = "https://www.google.com/maps";
    }
    
    // Direkt über das Rust-Backend im Standardbrowser des Nutzers öffnen
    use tauri_plugin_opener::OpenerExt;
    app_handle.opener().open_url(&url, None::<&str>)
        .map_err(|e| format!("Fehler beim Öffnen: {}", e))?;
        
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            lese_bild_metdaten,
            schreibe_bild_metdaten,
            hole_vorschaubild,
            oeffne_maps_browser
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-Anwendung");
}
