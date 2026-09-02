let aktuellerBildPfad = "";
let bilderListe = [];
let aktuellerIndex = -1;

async function zeigeMaps(event) {
    event.preventDefault()
    let gps = document.getElementById('position').value;

    try {
        // Ruft direkt unsere eigene, sichere Rust-Funktion auf
        await window.__TAURI__.core.invoke('oeffne_maps_browser', {
            gpsString: gps
        });
    } catch (fehler) {
        console.error("Fehler:", fehler);
    }
}

async function dateiAuswählen() {
    try {
        const ergebnis = await window.__TAURI__.core.invoke('plugin:dialog|open', {
            options: {
                title: 'Bilddatei für ExifTool auswählen',
                directory: false,
                multiple: false,
                filters: [
                    { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'avif', 'heic', 'heif'] }
                ]
            }
        });

        if (ergebnis) {
            const pfad = typeof ergebnis === 'object' ? ergebnis.path : ergebnis;
            aktuellerBildPfad = pfad;

            // Bilderliste des Ordners auslesen
            await ladeOrdnerBilder(pfad);

            // Metadaten für das aktuelle Bild einlesen
            exifAuslesen();
        }
    } catch (fehler) {
        document.getElementById("ausgabe").innerHTML = "<span style='color: red;'>Dialog-Fehler: " + fehler + "</span>";
    }
}

async function ladeOrdnerBilder(pfad) {
    try {
        bilderListe = await window.__TAURI__.core.invoke('hole_ordner_bilder', { dateipfad: pfad });
        // Finde den Index des aktuell geöffneten Bildes
        aktuellerIndex = bilderListe.indexOf(pfad);
    } catch (fehler) {
        console.error("Fehler beim Laden des Ordnerinhalts:", fehler);
        bilderListe = [pfad];
        aktuellerIndex = 0;
    }
}

function blaettern(richtung) {
    if (bilderListe.length === 0) return;

    aktuellerIndex += richtung;

    // Begrenzungen einhalten
    if (aktuellerIndex < 0) {
        aktuellerIndex = 0;
        return;
    }
    if (aktuellerIndex >= bilderListe.length) {
        aktuellerIndex = bilderListe.length - 1;
        return;
    }

    aktuellerBildPfad = bilderListe[aktuellerIndex];
    exifAuslesen();
}

async function dateiAuswählen() {
    try {
        const ergebnis = await window.__TAURI__.core.invoke('plugin:dialog|open', {
            options: {
                title: 'Bilddatei für ExifTool auswählen',
                directory: false,
                multiple: false,
                filters: [
                    { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'avif', 'heic', 'heif'] }
                ]
            }
        });

        // Wenn der Nutzer nicht abgebrochen hat (ergebnis ist nicht null)
        if (ergebnis) {
            // Falls das Ergebnis ein Objekt ist (z.B. { path: "..." }), holen wir den Pfad heraus,
            // ansonsten nehmen wir den String direkt.
            const pfad = typeof ergebnis === 'object' ? ergebnis.path : ergebnis;

            aktuellerBildPfad = pfad;

            // Sofort automatisch die Metadaten einlesen!
            exifAuslesen();
        }
    } catch (fehler) {
        document.getElementById("ausgabe").innerHTML = "<span style='color: red;'>Dialog-Fehler: " + fehler + "</span>";
    }
}

async function exifAuslesen() {
    const pfad = aktuellerBildPfad;
    const ausgabe = document.getElementById("ausgabe");
    const vorschauImg = document.getElementById("vorschau-bild");

    ausgabe.innerText = "Rufe ExifTool auf...";

    try {
        // 1. Metadaten über Rust holen
        const jsonText = await window.__TAURI__.core.invoke('lese_bild_metdaten', { dateipfad: pfad });
        const datenObjekt = JSON.parse(jsonText)[0]; 	// Das 1. JSON-Objekt im JSON-Array in JS-Objekt umwandeln

        if (bilderListe.length > 0) {
            document.getElementById('img-nummer').innerText = `# ${aktuellerIndex + 1}/${bilderListe.length}`;
        } else {
            document.getElementById('img-nummer').innerText = '# 0/0';
        }
        
        let datum = datenObjekt.DateTimeOriginal;
        if (typeof datum === 'undefined') {
            datum = '(unbekannt)';
        }
        document.getElementById('img-datum').innerText = '\u{1F4F7} ' + datum || '';
        document.getElementById('img-groesse').innerText = '⤢ ' + datenObjekt.ImageSize || '';

        document.getElementById('filename').value = datenObjekt.FileName || '';
        document.getElementById('caption').value = datenObjekt.CMB_Caption || '';
        document.getElementById('description').value = datenObjekt.Description || '';
        document.getElementById('keywords').value = datenObjekt.Keywords || '';
        document.getElementById('creator').value = datenObjekt.Creator || '';
        document.getElementById('copyright').value = datenObjekt.Copyright || '';
        document.getElementById('editor').value = datenObjekt.CMB_Editor || '';
        document.getElementById('position').value = datenObjekt.GPSPosition || '';

        const vollerPfad = pfad;
        // Erkennt automatisch Linux-Schrägstriche (/) und Windows-Backslashes (\)
        const letzterSlash = Math.max(vollerPfad.lastIndexOf('/'), vollerPfad.lastIndexOf('\\'));
        let ordner = "Unbekannt";
        if (letzterSlash !== -1) {
            ordner = vollerPfad.substring(0, letzterSlash);
        }
        // Den berechneten Ordnerpfad in das neue Label schreiben
        document.getElementById('ordner-pfad').innerText = ordner;

        // Wir nehmen das erste Element der Liste (ExifTool liefert immer ein Array)
        // und stellen es schön formatiert im Browser dar
        // ausgabe.innerText = JSON.stringify(datenObjekt[0], null, 2);
        ausgabe.innerText = jsonText;

        // Wir fragen Rust nach dem besten Weg für das Bild
        const vorschauErgebnis = await window.__TAURI__.core.invoke('hole_vorschaubild', { dateipfad: pfad });

        if (vorschauErgebnis === "STANDARD") {
            // Normales JPG/PNG über das Asset-Protokoll
            const assetUrl = window.__TAURI__.core.convertFileSrc(pfad);
            vorschauImg.src = assetUrl + "?t=" + new Date().getTime();
        } else if (vorschauErgebnis.startsWith("data:image/jpeg;base64,")) {
            // TIF/TIFF über den im RAM kompilierten Rust-Wandler
            vorschauImg.src = vorschauErgebnis;
        }

        vorschauImg.style.display = "block";



    } catch (fehler) {
        ausgabe.innerHTML = "<span style='color: red;'>Fehler: " + fehler + "</span>";
        vorschauImg.style.display = "none";
        infoText.innerText = "Fehler beim Laden";
    }
}

async function exifSchreiben(ereignis) {
    if (ereignis) ereignis.preventDefault();  // verbietet dem Browser den automatischen Seiten-Reset!

    const pfad = aktuellerBildPfad;
    const ausgabe = document.getElementById("ausgabe");

    ausgabe.innerText = "Speichere Daten über ExifTool...";

    // Wir sammeln alle aktuellen Werte aus den Eingabefeldern ein
    const daten = {
        dateipfad: pfad,
        filename: document.getElementById('filename').value,
        caption: document.getElementById('caption').value,
        description: document.getElementById('description').value,
        keywords: document.getElementById('keywords').value.split(',').map(s => s.trim()).join(', '),
        creator: document.getElementById('creator').value,
        copyright: document.getElementById('copyright').value,
        editor: document.getElementById('editor').value,
        gps: document.getElementById('position').value
    };

    try {
        // Wir schicken das gesamte Paket an die Rust-Funktion 'schreibe_bild_metdaten'
        const antwort = await window.__TAURI__.core.invoke('schreibe_bild_metdaten', daten);

        // Bei Erfolg zeigen wir die Meldung in grüner Schrift an
        ausgabe.innerHTML = "<span style='color: #00ff00;'>" + antwort + "</span>";

        // 2. Da der Pfad dank preventDefault() jetzt bombenfest im Feld stehen bleibt,
        // funktioniert das Neuladen nun augenblicklich und fehlerfrei!
        await exifAuslesen();

    } catch (fehler) {
        // Falls etwas schiefgeht (z.B. Datei schreibgeschützt), zeigen wir den Fehler an
        ausgabe.innerHTML = "<span style='color: red;'>Fehler beim Speichern: " + fehler + "</span>";
    }
}
