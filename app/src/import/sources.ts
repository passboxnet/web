import type { ImportFormat } from "@passbox/client/import";
import type { Locale } from "./messages";

export type SourceId =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "1password"
  | "bitwarden"
  | "keepass"
  | "passbolt"
  | "lastpass"
  | "dashlane"
  | "protonpass"
  | "csv"
  | "passbox";

export interface ImportSource {
  id: SourceId;
  name: string;
  /** Two letters for the tile. */
  monogram: string;
  /** File picker filter. */
  accept: string;
  /** Read the file in this format instead of detecting it. */
  forceFormat?: ImportFormat;
  /** A browser whose own password saving the user may want to turn off afterwards. */
  browser?: boolean;
  steps: Record<Locale, string[]>;
}

export const SOURCES: readonly ImportSource[] = [
  {
    id: "chrome",
    name: "Chrome",
    monogram: "Ch",
    accept: ".csv",
    browser: true,
    steps: {
      en: [
        "Open Chrome (also Brave, Opera or Vivaldi) and go to chrome://password-manager/settings.",
        "Next to “Export passwords”, click “Download file” and confirm with your computer password.",
        "Choose the downloaded file “Chrome Passwords.csv” here.",
      ],
      de: [
        "Öffnen Sie Chrome (auch Brave, Opera oder Vivaldi) und rufen Sie chrome://password-manager/settings auf.",
        "Klicken Sie bei „Passwörter exportieren“ auf „Datei herunterladen“ und bestätigen Sie mit dem Passwort Ihres Computers.",
        "Wählen Sie hier die heruntergeladene Datei „Chrome Passwörter.csv“.",
      ],
    },
  },
  {
    id: "edge",
    name: "Edge",
    monogram: "Ed",
    accept: ".csv",
    browser: true,
    steps: {
      en: [
        "Open Edge and go to edge://wallet/passwords.",
        "Click “…” next to “Saved passwords”, then “Export passwords”, and confirm with your computer password.",
        "Choose the downloaded CSV file here.",
      ],
      de: [
        "Öffnen Sie Edge und rufen Sie edge://wallet/passwords auf.",
        "Klicken Sie neben „Gespeicherte Kennwörter“ auf „…“ und dann auf „Kennwörter exportieren“. Bestätigen Sie mit dem Passwort Ihres Computers.",
        "Wählen Sie hier die heruntergeladene CSV-Datei.",
      ],
    },
  },
  {
    id: "firefox",
    name: "Firefox",
    monogram: "Fx",
    accept: ".csv",
    browser: true,
    steps: {
      en: [
        "Open Firefox and go to about:logins.",
        "Click “…” at the top right, then “Export Passwords…”, and confirm.",
        "Choose the file “logins.csv” here.",
      ],
      de: [
        "Öffnen Sie Firefox und rufen Sie about:logins auf.",
        "Klicken Sie oben rechts auf „…“ und dann auf „Passwörter exportieren…“. Bestätigen Sie die Abfrage.",
        "Wählen Sie hier die Datei „logins.csv“.",
      ],
    },
  },
  {
    id: "safari",
    name: "Safari / Apple Passwords",
    monogram: "Sa",
    accept: ".csv",
    browser: true,
    steps: {
      en: [
        "On your Mac, open the Passwords app (on older macOS: Safari → Settings → Passwords).",
        "Choose File → “Export All Passwords to File…” and confirm with Touch ID or your Mac password.",
        "Choose the file “Passwords.csv” here.",
      ],
      de: [
        "Öffnen Sie auf dem Mac die App „Passwörter“ (bei älterem macOS: Safari → Einstellungen → Passwörter).",
        "Wählen Sie Ablage → „Alle Passwörter in Datei exportieren …“ und bestätigen Sie mit Touch ID oder dem Mac-Passwort.",
        "Wählen Sie hier die Datei „Passwörter.csv“.",
      ],
    },
  },
  {
    id: "1password",
    name: "1Password",
    monogram: "1P",
    accept: ".1pux,.csv",
    steps: {
      en: [
        "Open the 1Password desktop app and unlock it.",
        "Choose File → Export, select the account and enter your 1Password password.",
        "Choose the format “1PUX” (keeps cards, identities and all fields; CSV only has logins) and save.",
        "Choose the .1pux file here. Passkeys and attachments are not exported by 1Password.",
      ],
      de: [
        "Öffnen und entsperren Sie die 1Password-App auf dem Computer.",
        "Wählen Sie Datei → Exportieren, dann das Konto, und geben Sie Ihr 1Password-Passwort ein.",
        "Wählen Sie das Format „1PUX“ (enthält Karten, Identitäten und alle Felder; CSV nur Anmeldungen) und speichern Sie.",
        "Wählen Sie hier die .1pux-Datei. Passkeys und Anhänge exportiert 1Password nicht.",
      ],
    },
  },
  {
    id: "bitwarden",
    name: "Bitwarden",
    monogram: "Bw",
    accept: ".json,.csv",
    steps: {
      en: [
        "Open the Bitwarden web vault and choose Tools → Export vault.",
        "Choose the file format “.json” (not “.json (Encrypted)”).",
        "Confirm with your master password and choose the file here. Passkeys are included.",
      ],
      de: [
        "Öffnen Sie den Bitwarden-Webtresor und wählen Sie Werkzeuge → Tresor exportieren.",
        "Wählen Sie das Dateiformat „.json“ (nicht „.json (Verschlüsselt)“).",
        "Bestätigen Sie mit Ihrem Master-Passwort und wählen Sie die Datei hier. Passkeys werden übernommen.",
      ],
    },
  },
  {
    id: "keepass",
    name: "KeePass / KeePassXC",
    monogram: "KP",
    accept: ".xml,.csv",
    steps: {
      en: [
        "KeePassXC: Database → Export → “XML File…” (keeps history and passkeys) or “CSV File…”.",
        "KeePass 2: File → Export → “KeePass XML (2.x)”.",
        "Choose the exported file here. A .kdbx file must be exported first.",
      ],
      de: [
        "KeePassXC: Datenbank → Exportieren → „XML-Datei …“ (mit Verlauf und Passkeys) oder „CSV-Datei …“.",
        "KeePass 2: Datei → Exportieren → „KeePass XML (2.x)“.",
        "Wählen Sie hier die exportierte Datei. Eine .kdbx-Datei muss zuerst exportiert werden.",
      ],
    },
  },
  {
    id: "passbolt",
    name: "Passbolt",
    monogram: "Pb",
    accept: ".csv",
    forceFormat: "passbolt-csv",
    steps: {
      en: [
        "In Passbolt, select the passwords or a folder, then More → Export (or “Export all”).",
        "Choose “CSV (KeePass)” and click Export. Since Passbolt 5.10 an administrator must allow CSV exports.",
        "Choose the CSV file here. Folders become tags. Alternatively, export KDBX, open it in KeePassXC and export XML.",
      ],
      de: [
        "Wählen Sie in Passbolt die Passwörter oder einen Ordner aus, dann Mehr → Exportieren (oder „Alle exportieren“).",
        "Wählen Sie „CSV (KeePass)“ und klicken Sie auf Exportieren. Ab Passbolt 5.10 muss ein Administrator den CSV-Export erlauben.",
        "Wählen Sie hier die CSV-Datei. Ordner werden zu Tags. Alternativ KDBX exportieren, in KeePassXC öffnen und als XML exportieren.",
      ],
    },
  },
  {
    id: "lastpass",
    name: "LastPass",
    monogram: "LP",
    accept: ".csv",
    steps: {
      en: [
        "Open your LastPass vault in the browser and choose Advanced options → Export.",
        "Confirm with your master password. The CSV file downloads.",
        "Choose the file here. Secure notes, cards and addresses are converted.",
      ],
      de: [
        "Öffnen Sie Ihren LastPass-Tresor im Browser und wählen Sie Erweiterte Optionen → Exportieren.",
        "Bestätigen Sie mit Ihrem Master-Passwort. Die CSV-Datei wird heruntergeladen.",
        "Wählen Sie hier die Datei. Sichere Notizen, Karten und Adressen werden übernommen.",
      ],
    },
  },
  {
    id: "dashlane",
    name: "Dashlane",
    monogram: "Da",
    accept: ".zip,.csv",
    steps: {
      en: [
        "Open the Dashlane web app and choose My account → Settings → Export data.",
        "Choose “Export to CSV”. Dashlane saves a ZIP file.",
        "Choose the ZIP file here (or a single credentials.csv).",
      ],
      de: [
        "Öffnen Sie die Dashlane-Web-App und wählen Sie Mein Konto → Einstellungen → Daten exportieren.",
        "Wählen Sie „In CSV exportieren“. Dashlane speichert eine ZIP-Datei.",
        "Wählen Sie hier die ZIP-Datei (oder eine einzelne credentials.csv).",
      ],
    },
  },
  {
    id: "protonpass",
    name: "Proton Pass",
    monogram: "PP",
    accept: ".zip,.json,.csv",
    steps: {
      en: [
        "In Proton Pass, open Settings → Export.",
        "Choose the format “JSON” (keeps vaults, cards and identities) without PGP encryption, and export.",
        "Choose the ZIP file here. Proton Pass does not export passkeys in a form other apps can use.",
      ],
      de: [
        "Öffnen Sie in Proton Pass Einstellungen → Exportieren.",
        "Wählen Sie das Format „JSON“ (mit Tresoren, Karten und Identitäten) ohne PGP-Verschlüsselung und exportieren Sie.",
        "Wählen Sie hier die ZIP-Datei. Passkeys exportiert Proton Pass nicht in einer für andere Apps nutzbaren Form.",
      ],
    },
  },
  {
    id: "csv",
    name: "Excel / CSV",
    monogram: "XL",
    accept: ".csv,.txt",
    forceFormat: "generic-csv",
    steps: {
      en: [
        "In Excel, choose File → Save as → “CSV UTF-8 (Comma delimited)”.",
        "The first row must contain the column titles, for example Name, Username, Password, Website.",
        "Choose the file here. In the next step you assign the columns.",
      ],
      de: [
        "Wählen Sie in Excel Datei → Speichern unter → „CSV UTF-8 (durch Trennzeichen getrennt)“.",
        "Die erste Zeile muss die Spaltentitel enthalten, zum Beispiel Name, Benutzername, Passwort, Website.",
        "Wählen Sie hier die Datei. Im nächsten Schritt ordnen Sie die Spalten zu.",
      ],
    },
  },
  {
    id: "passbox",
    name: "Passbox",
    monogram: "Px",
    accept: ".pbx-export",
    forceFormat: "passbox",
    steps: {
      en: [
        "In the other Passbox account, open Settings → Import and export → Export data.",
        "Choose “Encrypted file” and set an export password.",
        "Choose the .pbx-export file here and enter that password.",
      ],
      de: [
        "Öffnen Sie im anderen Passbox-Konto Einstellungen → Import und Export → Daten exportieren.",
        "Wählen Sie „Verschlüsselte Datei“ und legen Sie ein Export-Passwort fest.",
        "Wählen Sie hier die .pbx-export-Datei und geben Sie dieses Passwort ein.",
      ],
    },
  },
];

/** Human name of the app a format comes from, for messages. */
export function formatSourceName(format: ImportFormat): string {
  const names: Record<ImportFormat, string> = {
    passbox: "Passbox",
    "chrome-csv": "Chrome",
    "firefox-csv": "Firefox",
    "safari-csv": "Safari",
    "bitwarden-json": "Bitwarden",
    "bitwarden-csv": "Bitwarden",
    "1password-1pux": "1Password",
    "1password-csv": "1Password",
    "keepass-csv": "KeePass",
    "keepass-xml": "KeePass",
    "passbolt-csv": "Passbolt",
    "lastpass-csv": "LastPass",
    "dashlane-csv": "Dashlane",
    "dashlane-zip": "Dashlane",
    "protonpass-json": "Proton Pass",
    "protonpass-csv": "Proton Pass",
    "generic-csv": "CSV",
  };
  return names[format];
}
