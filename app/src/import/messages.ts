/**
 * Strings of the import wizard and the export dialog, in English and German.
 * Kept in one place so they can move into the shared translation catalogs
 * (packages/i18n) as they are: `{name}` placeholders, `_one`/`_other`
 * plural pairs, German uses "Sie" (see packages/i18n/GLOSSARY.md).
 */

const en = {
  // Wizard
  "import.title": "Import",
  "import.description": "Bring your passwords from a browser or another password manager into Passbox.",
  "import.privacy": "Your file is read on this device only. Its contents are encrypted before they are uploaded.",
  "import.step.source": "Source",
  "import.step.file": "File",
  "import.step.review": "Review",
  "import.step.done": "Done",
  "import.chooseSource": "Where are your passwords now?",
  "import.howTo": "How to export from {source}",
  "import.otherFormats": "Passbox recognises the format automatically, so any supported file works here.",
  "import.drop.title": "Drop the export file here",
  "import.drop.or": "or",
  "import.drop.button": "Choose file",
  "import.drop.reading": "Reading {name} …",
  "import.back": "Back",
  "import.next": "Continue",
  "import.cancel": "Cancel",
  "import.changeSource": "Choose another source",

  "import.password.title": "This Passbox export is protected",
  "import.password.label": "Export password",
  "import.password.hint": "The password chosen when the file was exported.",
  "import.password.submit": "Open file",

  "import.mapping.title": "Assign the columns",
  "import.mapping.description":
    "Passbox has guessed what each column contains. Check the assignment; the preview shows the first rows.",
  "import.mapping.column": "Column",
  "import.mapping.example": "Example",
  "import.mapping.target": "Import as",
  "import.mapping.rows_one": "{count} row",
  "import.mapping.rows_other": "{count} rows",
  "import.mapping.noColumns": "Assign at least a name, username, password, website or note.",
  "import.mapping.duplicate": "Each column type can be used only once. Change one of the duplicates.",
  "target.title": "Name",
  "target.username": "Username",
  "target.email": "Email",
  "target.password": "Password",
  "target.url": "Website",
  "target.totp": "One-time password (2FA)",
  "target.notes": "Notes",
  "target.folder": "Folder (becomes a tag)",
  "target.tags": "Tags",
  "target.favorite": "Favourite",
  "target.field": "Extra field",
  "target.secret": "Extra field (hidden)",
  "target.skip": "Do not import",

  "import.review.title": "Ready to import",
  "import.review.found_one": "{count} item found in {file}",
  "import.review.found_other": "{count} items found in {file}",
  "import.review.withTotp": "{count} with one-time passwords",
  "import.review.withPasskeys": "{count} with passkeys",
  "import.review.preview": "Preview",
  "import.review.more": "and {count} more",
  "import.col.name": "Name",
  "import.col.username": "Username",
  "import.col.website": "Website",
  "import.col.type": "Type",
  "import.col.decision": "Already in Passbox",

  "category.login": "Logins",
  "category.note": "Secure notes",
  "category.card": "Cards",
  "category.identity": "Identities",
  "category.other": "Other",
  "kind.login": "Login",
  "kind.note": "Secure note",
  "kind.card": "Card",
  "kind.identity": "Identity",
  "kind.other": "Other",
  "import.vault.title": "Import into",
  "import.vault.single": "One vault",
  "import.vault.new": "New vault …",
  "import.vault.newName": "Name of the new vault",
  "import.vault.bySource": "Keep the vaults from the file ({names})",
  "import.vault.bySourceHint": "Vaults with the same name are used; missing ones are created.",

  "import.duplicates.title_one": "{count} item already exists in Passbox",
  "import.duplicates.title_other": "{count} items already exist in Passbox",
  "import.duplicates.description": "Same website and username. Choose what to do with them:",
  "import.duplicates.none": "No duplicates: none of these items is in Passbox yet.",
  "import.duplicates.all": "For all duplicates",
  "import.duplicates.perItem": "Decide for each item",
  "decision.skip": "Skip",
  "decision.update": "Update existing",
  "decision.keep": "Keep both",

  "import.start_one": "Import {count} item",
  "import.start_other": "Import {count} items",
  "import.progress.title": "Importing …",
  "import.progress.count": "{done} of {total}",
  "import.progress.keepOpen": "Keep this page open until the import is finished.",
  "import.progress.stop": "Stop",

  "import.done.title": "Import finished",
  "import.done.stopped": "Import stopped",
  "import.done.created": "{count} added",
  "import.done.updated": "{count} updated",
  "import.done.skipped": "{count} skipped (already in Passbox)",
  "import.done.failed": "{count} could not be saved",
  "import.done.time": "Took {seconds} s",
  "import.done.deleteCsv": "Delete the CSV file now – it contains your passwords unencrypted.",
  "import.done.deleteFile": "Delete the export file now – it contains your passwords unencrypted.",
  "import.done.deleteHint": "Also empty the trash or recycle bin of your computer afterwards.",
  "import.done.browserTip":
    "Tip: turn off password saving in {source} so it does not compete with Passbox. Install the Passbox browser extension instead.",
  "import.done.show": "Show my items",
  "import.done.another": "Import another file",

  "warning.passkeys_not_exported":
    "Passkeys could not be imported because {source} does not export them ({count} affected). Keep them in {source} or add new ones on the website.",
  "warning.passkeys_imported": "Passkeys were imported ({count}). They work with the Passbox browser extension.",
  "warning.attachments_not_imported":
    "Some items have file attachments ({count} affected). Attachments are not part of the export file; save them separately.",
  "warning.trashed_skipped": "Items from the trash or recycle bin were left out ({count}).",
  "warning.empty_skipped": "Empty rows were left out ({count}).",
  "warning.converted_to_other":
    "Some items have a type Passbox does not have yet, such as SSH keys or servers ({count} affected). They were imported as “Other” with all their fields.",
  "warning.invalid_totp":
    "Some one-time password values were not setup keys ({count} affected). They were kept as hidden fields.",
  "warning.examples": "For example: {titles}",

  "error.unknown_format": "Passbox does not recognise this file. Choose “Excel/CSV” to assign the columns yourself.",
  "error.encrypted_export":
    "This file is encrypted by the other app. Export again without encryption (see the steps on the left).",
  "error.password_required": "Enter the export password.",
  "error.wrong_password": "The export password is wrong, or the file was changed.",
  "error.invalid_file": "The file is damaged or incomplete. Export it again and try once more.",
  "error.no_items": "The file contains no items.",
  "error.mapping_required": "Assign the columns first.",
  "error.tooLarge": "The file is larger than 200 MB. Export fewer items at once.",
  "error.generic": "The file could not be read: {message}",
  "error.import": "The import stopped: {message}",

  // Settings entry
  "settings.title": "Import and export",
  "settings.description": "Move your data into Passbox or take it with you.",
  "settings.import": "Import",
  "settings.importHint": "From Chrome, Edge, Firefox, Safari, 1Password, Bitwarden, KeePass, Passbolt and more.",
  "settings.importButton": "Import data",
  "settings.export": "Export",
  "settings.exportHint": "As an encrypted backup or as a CSV file for another password manager.",
  "settings.exportButton": "Export data",

  // Export dialog
  "export.title": "Export data",
  "export.description": "Save a copy of your items as a file.",
  "export.kind.encrypted": "Encrypted file (recommended)",
  "export.kind.encryptedHint":
    "A .pbx-export file protected with its own password. Use it as a backup or to move to another Passbox account.",
  "export.kind.csv": "CSV file (not encrypted)",
  "export.kind.csvHint":
    "For switching to another password manager. Anyone who opens the file can read all your passwords.",
  "export.vaults": "Vaults",
  "export.includeTrash": "Include items in the trash",
  "export.count_one": "{count} item will be exported.",
  "export.count_other": "{count} items will be exported.",
  "export.password": "Export password",
  "export.passwordHint": "Write it down. Without it, the file cannot be opened – not even by us.",
  "export.passwordRepeat": "Repeat export password",
  "export.passwordMismatch": "The passwords do not match.",
  "export.passwordWeak": "Choose a stronger password: at least four random words or 14 characters.",
  "export.csvWarningTitle": "The CSV file is not protected",
  "export.csvWarning":
    "All passwords are readable in plain text. Do not email it or store it in the cloud, and delete it as soon as you have imported it elsewhere. Passkeys and password history are not included.",
  "export.csvConfirm": "I understand that the file is not encrypted.",
  "export.masterPassword": "Master password",
  "export.masterPasswordHint": "Confirm that it is you.",
  "export.masterPasswordWrong": "The master password is wrong. Check upper and lower case and Caps Lock.",
  "export.submit": "Export",
  "export.cancel": "Cancel",
  "export.working": "Encrypting …",
  "export.done": "Export saved as {name}",
  "export.doneCsv": "Delete {name} as soon as you no longer need it.",
  "export.failed": "The export failed: {message}",
} as const;

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  "import.title": "Importieren",
  "import.description": "Übernehmen Sie Ihre Passwörter aus einem Browser oder einem anderen Passwort-Manager.",
  "import.privacy":
    "Ihre Datei wird nur auf diesem Gerät gelesen. Die Inhalte werden verschlüsselt, bevor sie hochgeladen werden.",
  "import.step.source": "Quelle",
  "import.step.file": "Datei",
  "import.step.review": "Prüfen",
  "import.step.done": "Fertig",
  "import.chooseSource": "Wo sind Ihre Passwörter jetzt gespeichert?",
  "import.howTo": "So exportieren Sie aus {source}",
  "import.otherFormats": "Passbox erkennt das Format automatisch – jede unterstützte Datei funktioniert hier.",
  "import.drop.title": "Exportdatei hierher ziehen",
  "import.drop.or": "oder",
  "import.drop.button": "Datei auswählen",
  "import.drop.reading": "{name} wird gelesen …",
  "import.back": "Zurück",
  "import.next": "Weiter",
  "import.cancel": "Abbrechen",
  "import.changeSource": "Andere Quelle wählen",

  "import.password.title": "Dieser Passbox-Export ist geschützt",
  "import.password.label": "Export-Passwort",
  "import.password.hint": "Das Passwort, das beim Exportieren gewählt wurde.",
  "import.password.submit": "Datei öffnen",

  "import.mapping.title": "Spalten zuordnen",
  "import.mapping.description":
    "Passbox hat erkannt, was in den Spalten steht. Prüfen Sie die Zuordnung; die Vorschau zeigt die ersten Zeilen.",
  "import.mapping.column": "Spalte",
  "import.mapping.example": "Beispiel",
  "import.mapping.target": "Importieren als",
  "import.mapping.rows_one": "{count} Zeile",
  "import.mapping.rows_other": "{count} Zeilen",
  "import.mapping.noColumns": "Ordnen Sie mindestens Name, Benutzername, Passwort, Website oder Notiz zu.",
  "import.mapping.duplicate": "Jede Zuordnung ist nur einmal möglich. Ändern Sie eine der doppelten Spalten.",
  "target.title": "Name",
  "target.username": "Benutzername",
  "target.email": "E-Mail",
  "target.password": "Passwort",
  "target.url": "Website",
  "target.totp": "Einmalcode (2FA)",
  "target.notes": "Notizen",
  "target.folder": "Ordner (wird zum Tag)",
  "target.tags": "Tags",
  "target.favorite": "Favorit",
  "target.field": "Zusätzliches Feld",
  "target.secret": "Zusätzliches Feld (verdeckt)",
  "target.skip": "Nicht importieren",

  "import.review.title": "Bereit zum Import",
  "import.review.found_one": "{count} Eintrag in {file} gefunden",
  "import.review.found_other": "{count} Einträge in {file} gefunden",
  "import.review.withTotp": "{count} mit Einmalcodes",
  "import.review.withPasskeys": "{count} mit Passkeys",
  "import.review.preview": "Vorschau",
  "import.review.more": "und {count} weitere",
  "import.col.name": "Name",
  "import.col.username": "Benutzername",
  "import.col.website": "Website",
  "import.col.type": "Art",
  "import.col.decision": "Schon in Passbox",

  "category.login": "Anmeldungen",
  "category.note": "Sichere Notizen",
  "category.card": "Karten",
  "category.identity": "Identitäten",
  "category.other": "Sonstiges",
  "kind.login": "Anmeldung",
  "kind.note": "Sichere Notiz",
  "kind.card": "Karte",
  "kind.identity": "Identität",
  "kind.other": "Sonstiges",
  "import.vault.title": "Importieren in",
  "import.vault.single": "Einen Tresor",
  "import.vault.new": "Neuer Tresor …",
  "import.vault.newName": "Name des neuen Tresors",
  "import.vault.bySource": "Tresore aus der Datei übernehmen ({names})",
  "import.vault.bySourceHint": "Tresore mit gleichem Namen werden verwendet, fehlende werden angelegt.",

  "import.duplicates.title_one": "{count} Eintrag ist schon in Passbox",
  "import.duplicates.title_other": "{count} Einträge sind schon in Passbox",
  "import.duplicates.description": "Gleiche Website und gleicher Benutzername. Was soll damit passieren?",
  "import.duplicates.none": "Keine Duplikate: Keiner dieser Einträge ist bereits in Passbox.",
  "import.duplicates.all": "Für alle Duplikate",
  "import.duplicates.perItem": "Für jeden Eintrag einzeln entscheiden",
  "decision.skip": "Überspringen",
  "decision.update": "Vorhandenen aktualisieren",
  "decision.keep": "Beide behalten",

  "import.start_one": "{count} Eintrag importieren",
  "import.start_other": "{count} Einträge importieren",
  "import.progress.title": "Wird importiert …",
  "import.progress.count": "{done} von {total}",
  "import.progress.keepOpen": "Lassen Sie diese Seite geöffnet, bis der Import abgeschlossen ist.",
  "import.progress.stop": "Anhalten",

  "import.done.title": "Import abgeschlossen",
  "import.done.stopped": "Import angehalten",
  "import.done.created": "{count} hinzugefügt",
  "import.done.updated": "{count} aktualisiert",
  "import.done.skipped": "{count} übersprungen (schon in Passbox)",
  "import.done.failed": "{count} konnten nicht gespeichert werden",
  "import.done.time": "Dauer: {seconds} s",
  "import.done.deleteCsv": "Löschen Sie die CSV-Datei jetzt – sie enthält Ihre Passwörter unverschlüsselt.",
  "import.done.deleteFile": "Löschen Sie die Exportdatei jetzt – sie enthält Ihre Passwörter unverschlüsselt.",
  "import.done.deleteHint": "Leeren Sie danach auch den Papierkorb Ihres Computers.",
  "import.done.browserTip":
    "Tipp: Schalten Sie das Speichern von Passwörtern in {source} aus, damit es nicht mit Passbox konkurriert. Installieren Sie stattdessen die Passbox-Browsererweiterung.",
  "import.done.show": "Meine Einträge anzeigen",
  "import.done.another": "Weitere Datei importieren",

  "warning.passkeys_not_exported":
    "Passkeys konnten nicht übernommen werden, weil {source} sie nicht exportiert ({count} betroffen). Behalten Sie sie in {source} oder legen Sie auf der Website neue an.",
  "warning.passkeys_imported":
    "Passkeys wurden übernommen ({count}). Sie funktionieren mit der Passbox-Browsererweiterung.",
  "warning.attachments_not_imported":
    "Einige Einträge haben Dateianhänge ({count} betroffen). Anhänge sind nicht Teil der Exportdatei; sichern Sie sie separat.",
  "warning.trashed_skipped": "Einträge aus dem Papierkorb wurden ausgelassen ({count}).",
  "warning.empty_skipped": "Leere Zeilen wurden ausgelassen ({count}).",
  "warning.converted_to_other":
    "Einige Einträge haben eine Art, die Passbox noch nicht kennt, z. B. SSH-Schlüssel oder Server ({count} betroffen). Sie wurden mit allen Feldern als „Sonstiges“ übernommen.",
  "warning.invalid_totp":
    "Einige Einmalcode-Werte waren keine Einrichtungsschlüssel ({count} betroffen). Sie wurden als verdeckte Felder übernommen.",
  "warning.examples": "Zum Beispiel: {titles}",

  "error.unknown_format":
    "Passbox erkennt diese Datei nicht. Wählen Sie „Excel/CSV“, um die Spalten selbst zuzuordnen.",
  "error.encrypted_export":
    "Diese Datei wurde von der anderen App verschlüsselt. Exportieren Sie erneut ohne Verschlüsselung (siehe Anleitung links).",
  "error.password_required": "Geben Sie das Export-Passwort ein.",
  "error.wrong_password": "Das Export-Passwort ist falsch oder die Datei wurde verändert.",
  "error.invalid_file":
    "Die Datei ist beschädigt oder unvollständig. Exportieren Sie sie erneut und versuchen Sie es noch einmal.",
  "error.no_items": "Die Datei enthält keine Einträge.",
  "error.mapping_required": "Ordnen Sie zuerst die Spalten zu.",
  "error.tooLarge": "Die Datei ist größer als 200 MB. Exportieren Sie weniger Einträge auf einmal.",
  "error.generic": "Die Datei konnte nicht gelesen werden: {message}",
  "error.import": "Der Import wurde unterbrochen: {message}",

  "settings.title": "Import und Export",
  "settings.description": "Daten zu Passbox umziehen oder mitnehmen.",
  "settings.import": "Importieren",
  "settings.importHint": "Aus Chrome, Edge, Firefox, Safari, 1Password, Bitwarden, KeePass, Passbolt und mehr.",
  "settings.importButton": "Daten importieren",
  "settings.export": "Exportieren",
  "settings.exportHint": "Als verschlüsselte Sicherung oder als CSV-Datei für einen anderen Passwort-Manager.",
  "settings.exportButton": "Daten exportieren",

  "export.title": "Daten exportieren",
  "export.description": "Speichern Sie eine Kopie Ihrer Einträge als Datei.",
  "export.kind.encrypted": "Verschlüsselte Datei (empfohlen)",
  "export.kind.encryptedHint":
    "Eine .pbx-export-Datei mit eigenem Passwort. Ideal als Sicherung oder für den Umzug in ein anderes Passbox-Konto.",
  "export.kind.csv": "CSV-Datei (unverschlüsselt)",
  "export.kind.csvHint":
    "Für den Wechsel zu einem anderen Passwort-Manager. Jeder, der die Datei öffnet, kann alle Passwörter lesen.",
  "export.vaults": "Tresore",
  "export.includeTrash": "Einträge im Papierkorb mit exportieren",
  "export.count_one": "{count} Eintrag wird exportiert.",
  "export.count_other": "{count} Einträge werden exportiert.",
  "export.password": "Export-Passwort",
  "export.passwordHint":
    "Notieren Sie es. Ohne dieses Passwort lässt sich die Datei nicht öffnen – auch nicht von uns.",
  "export.passwordRepeat": "Export-Passwort wiederholen",
  "export.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  "export.passwordWeak": "Wählen Sie ein stärkeres Passwort: mindestens vier zufällige Wörter oder 14 Zeichen.",
  "export.csvWarningTitle": "Die CSV-Datei ist nicht geschützt",
  "export.csvWarning":
    "Alle Passwörter sind im Klartext lesbar. Versenden Sie die Datei nicht per E-Mail, legen Sie sie nicht in der Cloud ab und löschen Sie sie, sobald Sie sie anderswo importiert haben. Passkeys und Passwort-Verlauf sind nicht enthalten.",
  "export.csvConfirm": "Mir ist bewusst, dass die Datei nicht verschlüsselt ist.",
  "export.masterPassword": "Master-Passwort",
  "export.masterPasswordHint": "Bestätigen Sie, dass Sie es sind.",
  "export.masterPasswordWrong":
    "Das Master-Passwort ist falsch. Achten Sie auf Groß-/Kleinschreibung und die Feststelltaste.",
  "export.submit": "Exportieren",
  "export.cancel": "Abbrechen",
  "export.working": "Wird verschlüsselt …",
  "export.done": "Export als {name} gespeichert",
  "export.doneCsv": "Löschen Sie {name}, sobald Sie die Datei nicht mehr brauchen.",
  "export.failed": "Der Export ist fehlgeschlagen: {message}",
};

export type Locale = "en" | "de";

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, de };

/**
 * German when the page (`<html lang>`) or the browser is set to German,
 * otherwise English. Until these strings move into the shared catalogs, the
 * page language wins only when it is German, since index.html defaults to "en".
 */
export function currentLocale(): Locale {
  const page = typeof document !== "undefined" ? document.documentElement.lang : "";
  const browser = typeof navigator !== "undefined" ? (navigator.languages?.[0] ?? navigator.language ?? "") : "";
  return [page, browser].some((lang) => lang.toLowerCase().startsWith("de")) ? "de" : "en";
}

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** A translator for `locale`. Numbers are formatted for the locale. */
export function translator(locale: Locale = currentLocale()): Translate {
  const catalog = catalogs[locale];
  const number = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US");
  return (key, values = {}) =>
    (catalog[key] ?? en[key]).replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      if (value === undefined) return match;
      return typeof value === "number" ? number.format(value) : value;
    });
}

/** Picks the `_one` or `_other` variant of a key for `count`. */
export function plural(
  t: Translate,
  base: string,
  count: number,
  values: Record<string, string | number> = {},
): string {
  const key = `${base}_${count === 1 ? "one" : "other"}` as MessageKey;
  return t(key, { count, ...values });
}

export const messageCatalogs = catalogs;
