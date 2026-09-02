let aktuellerBildPfad = "";
let bilderListe = [];
let aktuellerIndex = -1;
let status = document.getElementById('statusleiste');
let stapelmodus = 0;

let bildTypen = ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff',
                     'webp', 'avif', 'heic', 'heif']

const invoke = window.__TAURI__.core.invoke;

function zeigeStatus(nachricht) {
    status.innerText = nachricht;
}

async function dateiAuswählen() {
    try {
        const ergebnis = await invoke('plugin:dialog|open', {
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

 async function ladeOrdnerBilder(pfad) {
    try {
        bilderListe = await invoke('hole_ordner_bilder', { 
            dateipfad: pfad,
            gueltigeEndungen: bildTypen
        });
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

async function waehleUndLadeBilder(isFolder = false, selectMultiple = false) {
    try {
        // Auswahl eines oder mehrerer Bilder oder eines Ordners.
        let auswahl = await window.__TAURI__.dialog.open({
            directory: isFolder,
            multiple: selectMultiple, 
            filters: [
                { name: 'Bilder', extensions: bildTypen }
            ]
        });
        if (auswahl === null) {
            return [];  // 1. Nutzer hat den Dialog geschlossen/abgebrochen
        }

        if (isFolder) {
            stapelmodus = 2         // Ordner (evtl. nur mit einer Datei)
            bilderListe = await invoke('hole_ordner_bilder', {
                dateipfad: auswahl,
                gueltigeEndungen: bildTypen
            });
            if (bilderListe.length === 1) {
                auswahl = bilderListe;
                stapelmodus = 0;    // Einzelmodus
            }
        } else {
            if (auswahl.length === 1) {
                stapelmodus = 0;    // Einzelmodus
            } else {
                stapelmodus = 1;    // mehrere Dateien
            }
        }

        let dirPath = "";

        // 2. Prüfen, ob der Nutzer nicht auf "Abbrechen" geklickt hat
        if (stapelmodus === 0) {
            // Einzelmodus
            // Tauri gibt uns IMMER ein Array zurück, egal ob 1 oder 10 Dateien gewählt wurden.
            // Wir merken uns die erste Datei aus der Auswahl als Startbild.
            const startBild = auswahl[0]; 

            // 3. Wir schicken das Array direkt an Rust
            bilderListe = await invoke('hole_ordner_bilder', {
                dateipfad: startBild,
                gueltigeEndungen: bildTypen
            });
            
            // 4. Wir finden den Index des Startbildes in der sortierten Liste
            aktuellerIndex = bilderListe.indexOf(startBild);

            aktuellerBildPfad = startBild;
            exifAuslesen();

        } else if (stapelmodus === 1) {
            // mehrere ausgewählte Bilder
            bilderListe = auswahl;
            // Ordner = Ordner des 1. Bildes
            dirPath = auswahl[0].substring(0, Math.max(auswahl[0].lastIndexOf('/'), auswahl[0].lastIndexOf('\\')));
        } else {
            //await ladeOrdnerBilder(auswahl);
            dirPath = auswahl;
        }

        if (stapelmodus > 0) {
            zeigeStatus(`${bilderListe.length} Bilder`);

            const vorschauImg = document.getElementById("vorschau-bild");
            vorschauImg.src = "batch-icon.png";
            vorschauImg.style.display = "block";

            vorschauImg.title = bilderListe.join('\n');

            document.getElementById('img-datum').innerText = "STAPELMODUS";
            document.getElementById('img-groesse').innerText = `${bilderListe.length} Bilder`;

            document.getElementById('ordner-pfad').innerText = dirPath;

            document.getElementById('filename').value = '*';
            document.getElementById('caption').value = '';
            document.getElementById('description').value = '';
            document.getElementById('keywords').value = '';
            document.getElementById('creator').value = '';
            document.getElementById('copyright').value = '';
            document.getElementById('editor').value = '';
            document.getElementById('position').value = '';
        }
    } catch (fehler) {
        zeigeStatus("Fehler beim Laden der Bilder: " + fehler);
        vorschauImg.style.display = "none";
    }
}

/* async function oeffneBilderDialog() {
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
} */

function blaettern(richtung) {
    if (bilderListe.length === 0) return;
    if (richtung > 0) {
        aktuellerIndex = (aktuellerIndex + 1) % bilderListe.length;
    } else {
        aktuellerIndex = (aktuellerIndex - 1 + bilderListe.length) % bilderListe.length;
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
        const jsonText = await invoke('lese_bild_metdaten', { dateipfad: pfad });
        // Das 1. JSON-Objekt im JSON-Array in JS-Objekt umwandeln
        const datenObjekt = JSON.parse(jsonText)[0]; 	

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
        const vorschauErgebnis = await invoke('hole_vorschaubild', { dateipfad: pfad });

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
        await invoke('oeffne_maps_browser', {
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
        const antwort = await invoke('schreibe_bild_metdaten', daten);

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
