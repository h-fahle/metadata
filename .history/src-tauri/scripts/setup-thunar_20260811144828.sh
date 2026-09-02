#!/bin/bash

UCA_FILE="/home/$1/.config/Thunar/uca.xml"

# Falls die Datei nicht existiert (z. B. frisch angelegter User), brechen wir ab
if [ ! -f "$UCA_FILE" ]; then exit; fi

# 1. Altes Menü entfernen (falls vorhanden), um Duplikate zu vermeiden
# Wir löschen den alten Block von <action> bis </action>, der Ihre ID enthält
if grep -q "metadata-script-hf-2026-1" "$UCA_FILE"; then
    # Löscht den XML-Block der alten Version 1 sauber heraus
    sed -i '/<unique-id>metadata-script-hf-2026-1<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
    sed -i '/<unique-id>metadata-script-hf-2026-1a<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
fi

# 2. Prüfen, ob die neue Version (2026-2) schon da ist. Wenn ja, fertig.
if grep -q "metadata-script-hf-2026-2" "$UCA_FILE"; then exit; fi

NEW_ACTION='<action>
	<icon>/opt/metadata/metadata.png</icon>
	<name>Metadaten Editor</name>
	<submenu></submenu>
	<unique-id>metadata-script-hf-2026-2</unique-id>
	<command>/opt/metadata/start.sh %F</command>
	<description>Metadaten von Bild-Dateien anzeigen/bearbeiten</description>
	<range></range>
	<patterns>*</patterns>
	<image-files/>
</action>
<action>
	<icon>/opt/metadata/metadata.png</icon>
	<name>Metadaten Editor</name>
	<submenu></submenu>
	<unique-id>metadata-script-hf-2026-2a</unique-id>
	<command>/opt/metadata/start.sh %f</command>
	<description>Metadaten der Bilder eines Ordners bearbeiten</description>
	<range>1</range>
	<patterns>*</patterns>
	<directories/>
</action>
'

# Letzte Zeile (</actions>) löschen, neuen Block anhängen und XML schließen
sed -i '$d' "$UCA_FILE"
echo "$NEW_ACTION" >> "$UCA_FILE"
echo "</actions>" >> "$UCA_FILE"

echo "Metadata Actions wurden auf Version 2 aktualisiert für User '$1'!"
