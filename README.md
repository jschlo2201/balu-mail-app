# Balu-Mail

**Ein E-Mail-Programm für alle Ihre Adressen** – für Windows, Android und als eigene Webseite. Die Bedienung ist an bekannte Webmail-Oberflächen angelehnt: Posteingang aller Konten auf einen Blick, Löschen und Gelesen direkt an jeder Mail, Kalender mit Erinnerungen.

Balu-Mail ist kostenlos und verbindet sich **direkt** mit Ihrem E-Mail-Anbieter (GMX, WEB.DE, Gmail, Outlook, T-Online, iCloud …). Es gibt keinen Balu-Mail-Server, der Ihre Mails oder Passwörter sieht.

---

## Herunterladen

Unter **[Releases](../../releases/latest)** liegt immer die neueste Version:

| Gerät | Datei | So geht's |
|---|---|---|
| Windows 10/11 | `Balu-Mail.msi` | Herunterladen und doppelklicken. |
| Android-Handy | `Balu-Mail.apk` | Auf dem Handy herunterladen und öffnen. |

`Balu-Mail-Programm.zip` brauchen Sie nicht – das holt sich Balu-Mail für seine Updates selbst.

### Windows warnt „Der Computer wurde durch Windows geschützt“
Balu-Mail ist ein kleines, privates Projekt ohne gekauftes Herausgeber-Zertifikat. Klicken Sie auf **Weitere Informationen** → **Trotzdem ausführen**. Bei der Frage „Möchten Sie zulassen …?“ auf **Ja**.

### Android fragt nach „Unbekannte Apps installieren“
Beim Öffnen der APK fragt Android, ob Ihr Browser bzw. Ihre Dateien-App Apps installieren darf: **Einstellungen** → Schalter **„Aus dieser Quelle zulassen“** einschalten → zurück → **Installieren**. Warnt Google Play Protect, auf **Weitere Details** → **Trotzdem installieren** tippen.

### Updates
Balu-Mail sucht selbst nach neuen Versionen und spielt sie automatisch ein – am PC und auf dem Handy. Sie müssen nichts tun.

---

## Erste Schritte

1. Balu-Mail starten → **Erstes E-Mail-Konto hinzufügen**.
2. Name, E-Mail-Adresse und Passwort eingeben. Bei bekannten Anbietern ergänzt Balu-Mail die Servereinstellungen selbst.
3. Weitere Adressen über **Einstellungen → Konten → Konto hinzufügen**.
4. Mehrere Geräte? Unter **Einstellungen → Abgleich** einrichten – dann sind Ihre Konten am PC und auf dem Handy automatisch gleich.

Ausführliche Hilfe steht im Programm unter **Einstellungen → Hilfe**.

### Hinweise je Anbieter

| Anbieter | Was ist zu tun? |
|---|---|
| **GMX, WEB.DE** | Einmal auf gmx.net/web.de anmelden → Einstellungen → **POP3/IMAP Abruf** → Zugriff erlauben. |
| **Gmail** | Ein **App-Passwort** verwenden: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (dafür muss die Bestätigung in zwei Schritten eingeschaltet sein). |
| **Outlook, Hotmail, Live** | Beim Konto „Microsoft-Anmeldung“ wählen. Dafür einmalig eine kostenlose Microsoft-App-ID anlegen – Anleitung in Balu-Mail unter **Einstellungen → Google & Microsoft**. |
| **iCloud, Yahoo, AOL** | Ein **app-spezifisches Passwort** beim Anbieter erstellen und dieses eintragen. |
| **Andere** | Beim Konto auf **Servereinstellungen** klicken und IMAP/SMTP-Angaben Ihres Anbieters eintragen. |

---

## Funktionen

- **Alle Konten in einem Posteingang**, dazu Ungelesen, Favoriten, Entwürfe und Gesendet über alle Konten
- Ordner anlegen, umbenennen, verschieben; Papierkorb-Ordner einzeln endgültig löschen
- **Automatische Entwürfe** – angefangene Mails gehen nicht verloren
- Bilder in Mails vergrößern, Bildbetrachter; externe Bilder erst nach Klick (Schutz vor Mitlesen)
- **Kalender**: Tag/Woche/Monat/Liste, Erinnerungen, Einladungen; Kalender Ihrer Mail-Konten, Google-Kalender, Internet-Kalender (z. B. Müllabfuhr); gesetzliche Feiertage Ihres Bundeslandes
- **Abgleich** zwischen PC, Handy und Webseite – verschlüsselt über Ihr eigenes Postfach
- Handy: Benachrichtigung bei neuen Mails, nach unten ziehen zum Aktualisieren
- PC: eigenes Programmfenster mit Symbol in der Taskleiste, läuft nach „X“ im Hintergrund weiter

---

## Für Bastler

- `app/` – Programm (Python-Standardbibliothek, keine Zusatzpakete) und Oberfläche (`web/`)
- `launcher/` – Windows-Programmfenster (WebView2) · `installer/` – Windows-Installer (WiX)
- `android/` – Android-App · `server/` – Balu-Mail als Webseite auf eigenem Server (z. B. Proxmox: `server/install-proxmox.sh`)
- `.github/workflows/msi.yml` – baut, testet und veröffentlicht bei jeder Änderung automatisch alle Versionen
