import { useState } from "react";

export function SettingsPage({ online, syncing, onExport }: {
  online: boolean;
  syncing: boolean;
  onExport: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setSaving(true);
    setError("");
    try {
      await onExport();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить копию.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="content-section top-section settings-section">
    <div className="section-heading"><h2>Резервная копия</h2></div>
    <div className="entry-card">
      <p>Скачайте все записи, категории и цели в файл JSON. Перед выгрузкой приложение отправит ожидающие изменения в общий профиль.</p>
      <button className="primary-button" type="button" disabled={!online || syncing || saving} onClick={() => void exportData()}>
        {saving ? "Готовим копию…" : "Скачать резервную копию"}
      </button>
      {!online && <p className="section-intro">Для выгрузки нужно подключение к сети.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
