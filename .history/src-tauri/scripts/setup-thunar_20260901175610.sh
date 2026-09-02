#!/bin/bash

# Das Skript wird via runuser als der echte Benutzer ausgeführt.
# Daher entspricht der aktuelle Benutzer (whoami) dem Zielbenutzer.
CURRENT_USER=$(whoami)
UCA_FILE="/home/$CURRENT_USER/.config/Thunar/uca.xml"

# Falls die Datei nicht existiert, brechen wir ab
if [ ! -f "$UCA_FILE" ]; then 
    exit 0
fi

# Funktion zum sauberen Entfernen aller Versionen (Alt und Neu)
remove_actions() {
    # Entfernt Version 1 (2026-1)
    if grep -q "metadata-script-hf-2026-1" "$UCA_FILE"; then
        sed -i '/<unique-id>metadata-script-hf-2026-1<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
        sed -i '/<unique-id>metadata-script-hf-2026-1a<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
    fi
    # Entfernt Version 2 (2026-2)
    if grep -q "metadata-script-hf-2026-2" "$UCA_FILE"; then
        sed -i '/<unique-id>metadata-script-hf-2026-2<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
        sed -i '/<unique-id>metadata-script-hf-2026-2a<\/unique-id>/,/<\/action>/d' "$UCA_FILE"
    fi
}

# Auswertung der Parameter, die von postinst/postrm übergeben werden
case "$1" in
    --clean|--remove)
        echo "Entferne Thunar-Aktionen für User '$CURRENT_USER'..."
        remove_actions
        echo "Thunar-Aktionen erfolgreich entfernt!"
        ;;
        
    --initialize|*)
        # Zuerst alte und eventuell bestehende Versionen sauber löschen (verhindert Duplikate)
        remove_actions

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
		</action>'

        # Letzte Zeile (</actions>) löschen, neuen Block anhängen und XML schließen
        sed -i '$d' "$UCA_FILE"
        echo "$NEW_ACTION" >> "$UCA_FILE"
        echo "</actions>" >> "$UCA_FILE"

        echo "Metadata Actions wurden auf Version 2 aktualisiert für User '$CURRENT_USER'!"
        ;;
esac

exit 0
