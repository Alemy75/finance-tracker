import { useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { IconDownload, IconEdit2, IconPlus } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { initialCategories } from "@/finance";
import type { Category, TransactionType } from "@/finance";
import { useRetained } from "@/hooks/use-retained";
import { collapse, easeOut } from "@/lib/motion";

const sections = [
  { type: "expense", title: "Категории расходов" },
  { type: "income", title: "Категории доходов" }
] as const;

const categoryRowClassName = "flex min-h-12 items-center justify-between gap-3";
const backupText = "Скачайте все записи, категории и цели в файл JSON. Перед выгрузкой приложение отправит ожидающие изменения в общий профиль.";

function sorted(categories: Category[], type: TransactionType): Category[] {
  return categories.filter((item) => item.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
}

function RenameForm({ category, onRename, onDone }: {
  category: Category;
  onRename: (id: string, name: string) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onRename(category.id, name);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось переименовать категорию.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Field label="Новое название" htmlFor={`rename-${category.id}`}>
        <Input id={`rename-${category.id}`} type="text" maxLength={80} autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" disabled={saving} onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
      </div>
    </form>
  );
}

function CategorySection({ type, title, categories, onCreate, onRename }: {
  type: TransactionType;
  title: string;
  categories: Category[];
  onCreate: (type: TransactionType, name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const shownRenaming = useRetained(renaming);

  async function create(event: FormEvent<HTMLFormElement>) {
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

  return (
    <section className="mt-7 first:mt-3" aria-labelledby={`${type}-categories-title`} data-sk={`categories-${type}`}>
      <SectionHeading id={`${type}-categories-title`} title={title} />
      <Card className="gap-0 px-4 py-2">
        <ul>
          <AnimatePresence initial={false}>
            {categories.map((category, index) => (
              <motion.li key={category.id} {...collapse} transition={easeOut} className={index > 0 ? "border-t" : undefined}>
                <div className={categoryRowClassName}>
                  <strong className="text-sm font-semibold [overflow-wrap:anywhere]">{category.name}</strong>
                  <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" disabled={saving}
                    onClick={() => { setRenaming(category); setError(""); }}><IconEdit2 className="size-3.5" />Переименовать</Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <form className="grid gap-2 border-t pt-4 pb-3" onSubmit={create} noValidate>
          <Label htmlFor={`new-${type}-category`}>Новая категория</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input id={`new-${type}-category`} type="text" maxLength={80} value={newName}
              onChange={(event) => setNewName(event.target.value)} placeholder="Название" required />
            <Button type="submit" className="h-12 px-4" disabled={saving}><IconPlus />{saving ? "Добавляем…" : "Добавить"}</Button>
          </div>
          <FormError message={error} />
        </form>
      </Card>
      <ResponsiveDialog open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null); }}
        title="Переименовать категорию" description={shownRenaming ? `Сейчас: «${shownRenaming.name}». Новое название появится во всех записях.` : undefined}>
        {shownRenaming && <RenameForm key={shownRenaming.id} category={shownRenaming} onRename={onRename} onDone={() => setRenaming(null)} />}
      </ResponsiveDialog>
    </section>
  );
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

  return (
    <div>
      {sections.map((section) => (
        <CategorySection key={section.type} type={section.type} title={section.title} categories={sorted(categories, section.type)}
          onCreate={onCreateCategory} onRename={onRenameCategory} />
      ))}
      <section className="mt-7" data-sk="backup">
        <SectionHeading title="Резервная копия" />
        <Card className="gap-4 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">{backupText}</p>
          <Button size="lg" className="w-full" disabled={!online || syncing || saving} onClick={() => void exportData()}>
            <IconDownload />{saving ? "Готовим копию…" : "Скачать резервную копию"}
          </Button>
          {!online && <p className="text-[13px] leading-relaxed text-muted-foreground">Для выгрузки нужно подключение к сети.</p>}
          <FormError message={error} />
        </Card>
      </section>
    </div>
  );
}

export function SettingsSkeleton({ categories }: { categories: Category[] | null }) {
  const shown = categories ?? initialCategories;
  return (
    <div aria-hidden="true">
      {sections.map((section) => (
        <section key={section.type} className="mt-7 first:mt-3" data-sk={`categories-${section.type}`}>
          <SectionHeading title={<SkeletonText sample={section.title} />} />
          <Card className="gap-0 px-4 py-2">
            <ul>
              {sorted(shown, section.type).map((category, index) => (
                <li key={category.id} className={index > 0 ? "border-t" : undefined}>
                  <div className={categoryRowClassName}>
                    <strong className="text-sm font-semibold"><SkeletonText sample={category.name} /></strong>
                    <span className="-mr-2 inline-flex h-9 items-center px-3 text-sm font-semibold"><SkeletonText sample="__Переименовать" /></span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 border-t pt-4 pb-3">
              <span className="text-[13px] leading-none font-semibold"><SkeletonText sample="Новая категория" /></span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Skeleton className="h-12" /><Skeleton className="h-12 w-[7.5rem]" /></div>
            </div>
          </Card>
        </section>
      ))}
      <section className="mt-7" data-sk="backup">
        <SectionHeading title={<SkeletonText sample="Резервная копия" />} />
        <Card className="gap-4 p-5">
          <p className="text-sm leading-relaxed"><SkeletonText sample={backupText} /></p>
          <Skeleton className="h-12" />
        </Card>
      </section>
    </div>
  );
}
