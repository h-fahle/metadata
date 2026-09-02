let aktuellerBildPfad = "";
let bilderListe = [];
let aktuellerIndex = -1;
let status = document.getElementById('statusleiste');
let stapelmodus = 0;

const invoke = window.__TAURI__.core.invoke;

let bildTypen = ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff',
    'webp', 'avif', 'heic', 'heif']

document.addEventListener('DOMContentLoaded', () => {

    // Alle Buttons mit der Klasse "pager-btn" auswählen
    const pagerButtons = document.querySelectorAll('.pager-btn');
    pagerButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // Holt den Wert aus "data-schritt" und wandelt ihn in eine Zahl um
            const schritt = parseInt(event.currentTarget.dataset.schritt, 10);
            // Ruft deine bestehende Funktion auf
            blaettern(schritt);
        });
    });

    const selectButtons = document.querySelectorAll('.img-select-btn');
    selectButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // 1. Werte aus den data-Attributen als Text auslesen
            const ordnerRaw = event.currentTarget.dataset.ordner;
            const mehrfachRaw = event.currentTarget.dataset.mehrfach;

            // 2. Den Text in echte Booleans (true/false) umwandeln
            const ordnerModus = (ordnerRaw === 'true');
            const mehrfachAuswahl = (mehrfachRaw === 'true');

            // 3. Deine bestehende Funktion mit den richtigen Typen aufrufen
            waehleUndLadeBilder(ordnerModus, mehrfachAuswahl);
        });
    });

    // Den Maps-Button über seine Klasse finden
    const mapsBtn = document.querySelector('.maps-trigger-btn');
    if (mapsBtn) {
        // Das 'event' wird hier automatisch injiziert und weitergereicht
        mapsBtn.addEventListener('click', (event) => {
            zeigeMaps(event);
        });
    }

    const exifBtn = document.getElementById('btn-exif-schreiben');
    if (exifBtn) {
        // Reicht das Event-Objekt direkt an deine Funktion weiter
        exifBtn.addEventListener('click', (event) => {
            exifSchreiben(event);
        });
    }

});


aktualisiereEingabeBereich("datei", "");

// Positionierung der Tooltip-Container
const container = document.querySelector('.tooltip-container');
// Berechne die Position bei jeder Mausbewegung
container.addEventListener('mousemove', (e) => {
    const abstandVomCursor = 15; // Pixel Platz zwischen Cursor und Tooltip
});


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
            document.getElementById('img-nummer').innerText = `- / ${bilderListe.length}`

            const vorschauImg = document.getElementById("vorschau-bild");
            vorschauImg.src = "batch-icon.png";
            vorschauImg.style.display = "block";

            document.getElementById('img-datum').innerText = "STAPELMODUS";
            document.getElementById('img-groesse').innerText = "";

            document.getElementById('ordner-pfad').innerText = dirPath;
            aktualisiereEingabeBereich('ordner', bilderListe);
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
            document.getElementById('img-nummer').innerText = `${aktuellerIndex + 1} / ${bilderListe.length}`;
        } else {
            document.getElementById('img-nummer').innerText = '0 / 0';
        }

        let aufnahmeDatum = datenObjekt.DateTimeOriginal;
        if (typeof aufnahmeDatum === 'undefined') aufnahmeDatum = '---';

        document.getElementById('img-datum').innerText = '\u{1F4F7} ' + aufnahmeDatum || '';
        document.getElementById('img-groesse').innerText = '⤢ ' + datenObjekt.ImageSize || '';

        aktualisiereEingabeBereich('datei', datenObjekt.FileName);
        //document.getElementById('filename').value = datenObjekt.FileName || '';
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

        // WICHTIG: Egal ob "STANDARD" (Originalpfad) oder der neue Cache-Pfad von Rust reinkommt:
        // Wir jagen den Pfad einfach immer durch convertFileSrc!
        const finalerPfad = (vorschauErgebnis === "STANDARD") ? pfad : vorschauErgebnis;

        const assetUrl = window.__TAURI__.core.convertFileSrc(finalerPfad);
        vorschauImg.src = assetUrl + "?t=" + new Date().getTime();

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
    if (ereignis) ereignis.preventDefault();

    const istStapel = (stapelmodus > 0);
    
    // Sicherstellen, dass wir ein echtes, sauberes Array haben
    let pfadeFuerRust = [];
    if (istStapel) {
        // Macht aus jedem Objekt-Zustand ein garantiertes Array von Strings
        pfadeFuerRust = Array.from(bilderListe).map(p => String(p));
    } else {
        if (aktuellerBildPfad === "") return;
        pfadeFuerRust = [String(aktuellerBildPfad)];
    }

    if (pfadeFuerRust.length === 0) {
        zeigeStatus("Keine Bilder zur Verarbeitung ausgewählt.");
        return;
    }

    zeigeStatus("Speichere Daten über ExifTool...");

    const filenameFeld = document.getElementById('filename');
    const filenameWert = filenameFeld ? filenameFeld.value : "";

    // Das Paket exakt aufbauen
    const daten = {
        appHandle: undefined, // Wird von Tauri im Hintergrund injiziert, muss im JS nicht befüllt werden
        dateipfade: pfadeFuerRust,
        stapelmodus: istStapel,
        filename: String(filenameWert),
        caption: String(document.getElementById('caption').value),
        description: String(document.getElementById('description').value),
        keywords: String(document.getElementById('keywords').value.split(',').map(s => s.trim()).join(', ')),
        creator: String(document.getElementById('creator').value),
        copyright: String(document.getElementById('copyright').value),
        editor: String(document.getElementById('editor').value),
        gps: String(document.getElementById('position').value)
    };

    try {
        const antwort = await invoke('schreibe_bild_metdaten', daten);
        zeigeStatus(antwort);

        if (!istStapel) {
            await zeigePopup(`Die Metadaten wurden erfolgreich geschrieben.`);
            await exifAuslesen();
        } else {
            await zeigePopup(`Die Metadaten wurden erfolgreich in ${pfadeFuerRust.length} Bilder geschrieben.`);
            zeigeStatus("Stapelverarbeitung für " + pfadeFuerRust.length + " Bilder erfolgreich abgeschlossen.");
        }
    } catch (fehler) {
        zeigeStatus("Fehler beim Schreiben: " + fehler);
    }
}

function zeigeStatus(nachricht) {
    status.innerText = nachricht;
}

async function zeigePopup(nachricht, titel = "Information", typ = "info") {
    try {
        // window.__TAURI__.dialog.message gibt ein Promise zurück, daher "await"
        await window.__TAURI__.dialog.message(nachricht, {
            title: titel,
            kind: typ // Erlaubt: 'info', 'warning', 'error'
        });
    } catch (fehler) {
        console.error("Popup-Fehler:", fehler);
        // Fallback: Falls Tauri blockiert, nutzen wir das Browser-Alert
        alert(`${titel}:\n${nachricht}`);
    }
}

// Diese Funktion steuert den Wechsel
function aktualisiereEingabeBereich(auswahlTyp, daten) {
    // Container zuerst leeren
    const container = document.getElementById('dynamischerBereich');
    container.innerHTML = '';

    if (auswahlTyp === 'ordner') {
        // FALL 1: Ordner ausgewählt -> Drop-Down nur zur Anzeige (disabled)
        const select = document.createElement('select');
        //select.disabled = true; // Reine Anzeige-Funktion, nicht editierbar
        select.style.cursor = 'default';
        select.addEventListener('change', (e) => {
            // Springt immer wieder automatisch auf das erste Element (Index 0) zurück
            e.target.selectedIndex = 0;
        });

        // 'daten' ist hier dein Array 'bilderListe' (z.B. Pfade)
        // Wir extrahieren direkt die Dateinamen (wie vorhin gelernt)
        daten.forEach(pfad => {
            const option = document.createElement('option');
            const dateiname = pfad.split('/').pop();
            option.textContent = dateiname;
            select.appendChild(option);
        });

        if (select.options.length > 0) {
            const originalText = select.options[0].innerText;
            select.options[0].innerText = originalText + "\u00A0\u00A0\u00A0\u00A0 ▼";
        }

        container.appendChild(select);

    } else if (auswahlTyp === 'datei') {
        // FALL 2: Einzelne Datei ausgewählt -> Editierbares Input-Feld
        const input = document.createElement('input');
        input.type = 'text';
        input.id = "filename";
        input.name = "filename"

        // 'daten' ist hier der einzelne Dateiname
        input.value = daten;
        container.appendChild(input);
    }
}

