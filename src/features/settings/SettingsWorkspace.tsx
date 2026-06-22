import { useRef, useState } from "react";
import { useAppSettings, useMomentumRepository } from "../../app/ApplicationDataContext";
import type { FocusDurationMinutes, ThemePreference } from "../../domain/models";
import { DataBackupService, parseBackupJson, validateBackupFile, type MomentumBackup } from "../../services/DataBackupService";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "An unknown data error occurred";
}

function themeFrom(value: string): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  throw new Error("Unsupported theme preference");
}

function durationFrom(value: string): FocusDurationMinutes {
  const duration = Number(value);
  if (duration === 15 || duration === 25 || duration === 45 || duration === 60) return duration;
  throw new Error("Unsupported focus duration");
}

export function SettingsWorkspace() {
  const repository = useMomentumRepository();
  const { settings, saveSettings, reloadSettings } = useAppSettings();
  const service = new DataBackupService(repository);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<MomentumBackup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateSettings(next: typeof settings) {
    setBusy("settings");
    setError(null);
    setMessage(null);
    try {
      await saveSettings(next);
      setMessage("Preferences saved.");
    } catch (settingsError) {
      console.error("Settings update failed", settingsError);
      setError(messageFrom(settingsError));
    } finally {
      setBusy(null);
    }
  }

  async function exportData() {
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const backup = await service.createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `momentum-backup-${backup.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Backup prepared. Active timer state was not included.");
    } catch (exportError) {
      console.error("Data export failed", exportError);
      setError(messageFrom(exportError));
    } finally {
      setBusy(null);
    }
  }

  async function chooseImport(file: File | undefined) {
    setPendingImport(null);
    setError(null);
    setMessage(null);
    if (!file) return;
    try {
      validateBackupFile(file);
      setPendingImport(parseBackupJson(await file.text()));
    } catch (importError) {
      console.error("Backup validation failed", importError);
      setError(messageFrom(importError));
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const confirmed = window.confirm("Replace all current Momentum data with this backup? Any active focus timer will be cancelled and cannot be restored.");
    if (!confirmed) return;
    setBusy("import");
    setError(null);
    setMessage(null);
    try {
      await service.importBackup(pendingImport);
      await reloadSettings();
      setPendingImport(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Backup imported. Your previous data was replaced atomically.");
    } catch (importError) {
      console.error("Data import failed", importError);
      setError(messageFrom(importError));
    } finally {
      setBusy(null);
    }
  }

  async function eraseAllData() {
    const confirmed = window.confirm("Erase every Momentum task, focus session, review, setting, and active timer? This cannot be undone.");
    if (!confirmed) return;
    setBusy("erase");
    setError(null);
    setMessage(null);
    try {
      await service.eraseAll();
      await reloadSettings();
      setPendingImport(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage("All Momentum data was erased. The app is back to its defaults.");
    } catch (eraseError) {
      console.error("Data erasure failed", eraseError);
      setError(messageFrom(eraseError));
    } finally {
      setBusy(null);
    }
  }

  const summary = pendingImport ? service.summary(pendingImport) : null;

  return (
    <div className="settings-workspace">
      <section className="settings-card" aria-labelledby="appearance-title">
        <div><p className="eyebrow">Appearance</p><h2 id="appearance-title">Choose your light.</h2><p>System follows this device and responds when its appearance changes.</p></div>
        <div className="settings-fields">
          <label>Theme<select value={settings.theme} disabled={busy === "settings"} onChange={(event) => void updateSettings({ ...settings, theme: themeFrom(event.target.value) })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label>Default focus duration<select value={settings.focusDurationMinutes} disabled={busy === "settings"} onChange={(event) => void updateSettings({ ...settings, focusDurationMinutes: durationFrom(event.target.value) })}>{[15, 25, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        </div>
      </section>

      <section className="settings-card data-card" aria-labelledby="backup-title">
        <div><p className="eyebrow">Backup</p><h2 id="backup-title">Keep a durable copy.</h2><p>Exports include tasks, finished sessions, reviews, and preferences. Active timers stay on this device.</p></div>
        <button className="button button-dark" disabled={busy !== null} type="button" onClick={() => void exportData()}>{busy === "export" ? "Preparing…" : "Export JSON backup"}</button>
      </section>

      <section className="settings-card data-card" aria-labelledby="import-title">
        <div><p className="eyebrow">Restore</p><h2 id="import-title">Import a backup.</h2><p>The file is fully validated before anything changes. Import replaces all current durable data.</p></div>
        <label className="file-field">Momentum JSON backup<input ref={fileInput} accept="application/json,.json" type="file" onChange={(event) => void chooseImport(event.target.files?.[0])} /></label>
        {summary && (
          <div className="import-preview" role="region" aria-label="Import preview">
            <strong>Ready to import</strong>
            <span>{summary.tasks} tasks · {summary.focusSessions} sessions · {summary.dailyReviews} reviews</span>
            <p>Confirmation will replace current data and cancel any active timer.</p>
            <button className="button button-dark" disabled={busy !== null} type="button" onClick={() => void confirmImport()}>{busy === "import" ? "Importing…" : "Confirm and replace data"}</button>
          </div>
        )}
      </section>

      <section className="settings-card danger-card" aria-labelledby="erase-title">
        <div><p className="eyebrow">Danger zone</p><h2 id="erase-title">Erase everything.</h2><p>Deletes all local Momentum data and returns preferences to their defaults.</p></div>
        <button className="button erase-button" disabled={busy !== null} type="button" onClick={() => void eraseAllData()}>{busy === "erase" ? "Erasing…" : "Erase all data"}</button>
      </section>

      {message && <p className="settings-message" role="status">{message}</p>}
      {error && <p className="action-error" role="alert">{error}</p>}
    </div>
  );
}
