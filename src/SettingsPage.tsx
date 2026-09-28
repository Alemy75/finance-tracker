import { useState } from "react";
import type { Category, TransactionType } from "./finance";

function CategorySection({ type, title, categories, onCreate, onRename }: {
  type: TransactionType;
  title: string;
  categories: Category[];
  onCreate: (type: TransactionType, name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onCreate(type, newName);
      setNewName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить категорию.");
    } finally {
      setSaving(false);
    }
  }

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      await onRename(editingId, editingName);
      setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось переименовать категорию.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="content-section category-section" aria-labelledby={`${type}-categories-title`}>
    <div className="section-heading"><h2 id={`${type}-categories-title`}>{title}</h2></div>
    <div className="entry-card">
      <ul className="category-settings-list">
        {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((category) => <li key={category.id}>
          <div className="category-settings-row">
            <strong>{category.name}</strong>
            <button className="text-button" type="button" disabled={saving} onClick={() => {
              setEditingId(category.id);
              setEditingName(category.name);
              setError("");
            }}>Переименовать</button>
          </div>
          {editingId === category.id && <form className="category-name-form" onSubmit={rename}>
            <label htmlFor={`rename-${category.id}`}>Новое название</label>
            <input id={`rename-${category.id}`} type="text" maxLength={80} value={editingName}
              onChange={(event) => setEditingName(event.target.value)} required />
            <div className="category-form-actions">
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setEditingId(null)}>Отмена</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
            </div>
          </form>}
        </li>)}
      </ul>
      <form className="category-name-form" onSubmit={create}>
        <label htmlFor={`new-${type}-category`}>Новая категория</label>
        <div className="category-add-row">
          <input id={`new-${type}-category`} type="text" maxLength={80} value={newName}
            onChange={(event) => setNewName(event.target.value)} placeholder="Название" required />
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Добавляем…" : "Добавить"}</button>
        </div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}

export function SettingsPage({ categories, online, syncing, onCreateCategory, onRenameCategory, onExport }: {
  categories: Category[];
  online: boolean;
  syncing: boolean;
  onCreateCategory: (type: TransactionType, name: string) => Promise<void>;
  onRenameCategory: (id: string, name: string) => Promise<void>;
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

  return <div className="settings-section">
    <CategorySection type="expense" title="Категории расходов" categories={categories.filter((item) => item.type === "expense")}
      onCreate={onCreateCategory} onRename={onRenameCategory} />
    <CategorySection type="income" title="Категории доходов" categories={categories.filter((item) => item.type === "income")}
      onCreate={onCreateCategory} onRename={onRenameCategory} />
    <section className="content-section">
    <div className="section-heading"><h2>Резервная копия</h2></div>
    <div className="entry-card">
      <p>Скачайте все записи, категории и цели в файл JSON. Перед выгрузкой приложение отправит ожидающие изменения в общий профиль.</p>
      <button className="primary-button" type="button" disabled={!online || syncing || saving} onClick={() => void exportData()}>
        {saving ? "Готовим копию…" : "Скачать резервную копию"}
      </button>
      {!online && <p className="section-intro">Для выгрузки нужно подключение к сети.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    </section>
  </div>;
}
