let aktuellerBildPfad = "";
let bilderListe = [];
let aktuellerIndex = -1;
let status = document.getElementById('statusleiste');


function zeigeStatus(nachricht) {
    status.innerText = nachricht;
}

async function dateiAuswählen() {
    try {
        const ergebnis = await window.__TAURI__.core.invoke('plugin:dialog|open', {
            options: {
                title: 'Bilddatei für ExifTool auswählen',
                directory: false,
                multiple: true,
                filters: [
                    { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'avif', 'heic', 'heif'] }
                ]
            }
        });

        if (ergebnis) {
            const pfad = typeof ergebnis === 'object' ? ergebnis[0] : ergebnis;
            aktuellerBildPfad = pfad;

            // Bilderliste des Ordners auslesen
            await ladeOrdnerBilder(pfad);

            // Metadaten für das aktuelle Bild einlesen
            exifAuslesen();
        }
    } catch (fehler) {
        zeigeStatus("Dialog-Fehler: " + fehler);
    }
}

async function ladeOrdnerBilder(pfade) {
    try {
        bilderListe = await window.__TAURI__.core.invoke('hole_ordner_bilder', { dateipfad: pfade });
        // Finde den Index des gewünschten Bildes in der sortierten Liste
        if (aktuellerBildPfad) {
            aktuellerIndex = bilderListe.indexOf(aktuellerBildPfad);
        } else if (bilderListe.length > 0) {
            aktuellerIndex = 0; // Fallback: Erstes Bild anzeigen
        }
    } catch (fehler) {
        zeigeStatus(fehler);
    }
}


async function waehleUndLadeBilder() {
    try {
        // 1. Der EINE Dialog öffnet sich.
        // Dank 'multiple: true' kann der Nutzer EIN Bild ODER VIELE Bilder markieren.
        const auswahl = await window.__TAURI__.dialog.open({
            multiple: true, 
            directory: false,
            filters: [
                { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'avif', 'heic', 'heif'] }
            ]
        });

        // 2. Prüfen, ob der Nutzer nicht auf "Abbrechen" geklickt hat
        if (auswahl) {
           
            // Tauri gibt uns IMMER ein Array zurück, egal ob 1 oder 10 Dateien gewählt wurden.
            // Wir merken uns die erste Datei aus der Auswahl als Startbild.
            const startBild = auswahl[0]; 

            // 3. Wir schicken das Array direkt an Rust
            bilderListe = await window.__TAURI__.core.invoke('hole_ordner_bilder', { dateipfade: auswahl });
            
            // 4. Wir finden den Index des Startbildes in der sortierten Liste
            aktuellerIndex = bilderListe.indexOf(startBild);
            
            zeigeStatus(`${bilderListe.length} Bilder erfolgreich geladen.`);
        }
    } catch (fehler) {
        zeigeStatus("Fehler beim Laden der Bilder: " + fehler);
    }
}

async function oeffneBilderDialog() {
    try {
        const ausgewaehltePfade = await window.__TAURI__.dialog.open({
            multiple: true, // Erlaubt dem Nutzer, mehrere Dateien zu markieren
            directory: false,
            filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
        });

        // Wenn der Nutzer nicht abgebrochen hat
        if (ausgewaehltePfade && ausgewaehltePfade.length > 0) {
            // Wir nehmen das erste Bild aus der Auswahl als Startbild
            const erstesBild = ausgewaehltePfade[0]; 
            
            // Aufruf Ihrer angepassten Funktion
            await ladeOrdnerBilder(ausgewaehltePfade, erstesBild);
        }
    } catch (fehler) {
        zeigeStatus("Dialog-Fehler: " + fehler);
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

async function exifAuslesen() {
    const pfad = aktuellerBildPfad;
    const vorschauImg = document.getElementById("vorschau-bild");

    zeigeStatus("Rufe ExifTool auf...");

    try {
        // 1. Metadaten über Rust holen
        const jsonText = await window.__TAURI__.core.invoke('lese_bild_metdaten', { dateipfad: pfad });
        const datenObjekt = JSON.parse(jsonText)[0]; 	// Das 1. JSON-Objekt im JSON-Array in JS-Objekt umwandeln

        if (bilderListe.length > 0) {
            document.getElementById('img-nummer').innerText = `${aktuellerIndex + 1}/${bilderListe.length}`;
        } else {
            document.getElementById('img-nummer').innerText = '0/0';
        }

        let aufnahmeDatum = datenObjekt.DateTimeOriginal;
        if (typeof aufnahmeDatum === 'undefined') aufnahmeDatum = '---';

        document.getElementById('img-datum').innerText = '\u{1F4F7} ' + aufnahmeDatum || '';
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
        zeigeStatus(jsonText);

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
        zeigeStatus("Fehler: " + fehler);
        vorschauImg.style.display = "none";
    }
}

async function zeigeMaps(event) {
    event.preventDefault()
    let gps = document.getElementById('position').value;

    try {
        // Ruft direkt unsere eigene, sichere Rust-Funktion auf
        await window.__TAURI__.core.invoke('oeffne_maps_browser', {
            gpsString: gps
        });
    } catch (fehler) {
        zeigeStatus(fehler);
    }
}

async function exifSchreiben(ereignis) {
    if (ereignis) ereignis.preventDefault();  // verbietet dem Browser den automatischen Seiten-Reset!

    if (aktuellerBildPfad === "") return;

    zeigeStatus("Speichere Daten über ExifTool...");

    // Wir sammeln alle aktuellen Werte aus den Eingabefeldern ein
    const daten = {
        dateipfad: aktuellerBildPfad,
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
        zeigeStatus(antwort);

        // 2. Da der Pfad dank preventDefault() jetzt bombenfest im Feld stehen bleibt,
        // funktioniert das Neuladen nun augenblicklich und fehlerfrei!
        await exifAuslesen();

    } catch (fehler) {
        // Falls etwas schiefgeht (z.B. Datei schreibgeschützt), zeigen wir den Fehler an
        zeigeStatus(fehler);
    }
}
