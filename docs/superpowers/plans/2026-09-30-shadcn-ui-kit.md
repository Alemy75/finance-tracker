# UI Kit на shadcn/ui — план реализации (FT-17)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** перевести интерфейс PWA на UI Kit из shadcn/ui с темой «Лес», иконками Feather, анимациями motion и скелетонами, совпадающими с контентом до пикселя.

**Architecture:** Tailwind v4 + компоненты shadcn в `src/components/ui/`, прикладные компоненты в `src/components/app/`, экраны и их скелетоны в `src/screens/`. `App.tsx` оставляет только состояние, вход и синхронизацию. Модули данных (`finance.ts`, `localData.ts`, `sync*`, `authClient.ts`) не меняются.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4.3, shadcn 4 (new-york, Radix), motion 13, vaul, sonner, feather-icons (dev), @fontsource-variable/manrope.

## Global Constraints

- Спецификация: `docs/superpowers/specs/2026-09-30-shadcn-ui-kit-design.md`.
- Все пользовательские тексты, проверки ввода и сообщения об ошибках сохраняются дословно, кроме замены `window.confirm` на `AlertDialog`.
- `lucide-react` не используется; иконки только из `@/components/ui/icons`.
- Шрифт и все ассеты доступны без сети (workbox `globPatterns` включает `woff2`).
- `prefers-reduced-motion` отключает анимации (`MotionConfig reducedMotion="user"`).
- Поля ввода не меньше 16px на мобильных (иначе iOS увеличивает страницу).
- После каждой задачи: `pnpm check` и `pnpm build` без ошибок.

---

### Task 1: Инфраструктура Tailwind, shadcn, тема «Лес», шрифт, иконки

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`
- Create: `components.json`, `src/index.css`, `src/lib/utils.ts`, `scripts/generate-icons.mjs`, `src/components/ui/icons.tsx`
- Delete: `src/styles.css` (в Task 5, когда экраны переведены)

**Produces:** `cn(...inputs)` из `@/lib/utils`; иконки `IconX`, `IconChevronLeft`, … из `@/components/ui/icons` с пропсами `SVGProps<SVGSVGElement> & { size?: number }`; CSS-токены `--background --foreground --card --primary --primary-foreground --muted --muted-foreground --accent --border --input --ring --destructive --income --lime`.

- [x] Установить: `pnpm add tailwindcss @tailwindcss/vite motion vaul sonner radix-ui class-variance-authority tailwind-merge clsx tw-animate-css @fontsource-variable/manrope` и `pnpm add -D feather-icons`.
- [x] Алиас `@/*` в `tsconfig.app.json` (`baseUrl`/`paths`) и `resolve.alias` в `vite.config.ts`; плагин `tailwindcss()`; `globPatterns` + `woff2`; новые `theme_color`/`background_color`.
- [x] `components.json` (style new-york, rsc false, tsx true, css `src/index.css`, aliases `@/components`, `@/lib/utils`, `@/components/ui`).
- [x] `src/index.css`: `@import "tailwindcss"; @import "tw-animate-css";`, `@theme inline` с токенами, светлая и тёмная тема (через `@media (prefers-color-scheme: dark)`), базовые стили, фон с радиальным градиентом.
- [x] `scripts/generate-icons.mjs` читает `feather-icons/dist/icons.json` и пишет `icons.tsx` для списка иконок.
- [x] Проверка: `pnpm check && pnpm build`.

### Task 2: Компоненты shadcn и собственные примитивы UI Kit

**Files:** `src/components/ui/{button,card,input,label,textarea,native-select,badge,skeleton,dialog,drawer,alert-dialog,alert,separator,sonner}.tsx` (CLI `pnpm dlx shadcn@latest add …`, затем замена иконок lucide на Feather); собственные `segmented-control.tsx`, `choice-chips.tsx`, `field.tsx`, `money-input.tsx`, `animated-money.tsx`, `animated-progress.tsx`, `responsive-dialog.tsx`, `empty-state.tsx`, `section-heading.tsx`, `skeleton-text.tsx`, `use-media-query.ts`.

**Produces:**
- `SegmentedControl<T extends string>({ value, onChange, options: {value:T,label:string}[], label, layoutId })`
- `ChoiceChips<T extends string>({ value, onChange, options, label?, labelledBy? })`
- `Field({ label, htmlFor, hint?, error?, children })`
- `MoneyInput(props: InputProps & { size?: "default" | "lg" })`
- `AnimatedMoney({ value: number /* копейки */, className?, sign?: "+" | "−" | "" })`
- `AnimatedProgress({ value: number /* 0..100 */, label: string })`
- `ResponsiveDialog({ open, onOpenChange, title, description?, children })`
- `EmptyState({ title, description })`, `SectionHeading({ title, id?, aside? })`
- `SkeletonText({ className, sample })`

- [x] Сгенерировать компоненты CLI, удалить импорт lucide, проверить отсутствие `lucide-react` в `package.json`.
- [x] Написать собственные примитивы.
- [x] Проверка: `pnpm check`.

### Task 3: Оболочка приложения и прикладные компоненты

**Files:** `src/components/app/{app-shell,sync-status,conflict-card,balance-card,transaction-row,transaction-list,quick-entry,goal-card,page-transition}.tsx`; `src/App.tsx` (только разметка оболочки, логика без изменений).

- [x] `AppShell` — боковая панель (≥760px), шапка с состоянием сети и выходом, мобильная навигация с иконками; активный пункт — `layoutId`.
- [x] `SyncStatus`, `ConflictCard` на `Alert`.
- [x] `BalanceCard` с градиентом и `AnimatedMoney`; `TransactionRow`/`TransactionList` с `AnimatePresence`.
- [x] Проверка: `pnpm check`.

### Task 4: Экраны на новых компонентах

**Files:** `src/screens/{home,history,goals,settings,auth,opening-setup}.tsx`; удалить `src/History.tsx`, `src/Goals.tsx`, `src/SettingsPage.tsx`, `src/AuthPanel.tsx`.

- [x] Главная: баланс, цели, `QuickEntry` (сегменты, чипы, «Дополнительно» с анимацией высоты, toast «Запись сохранена…»), расходы месяца, последние записи.
- [x] История: выбор месяца (иконки), сводка, сегменты вида, чипы фильтра, исправление в `ResponsiveDialog`, удаление через `AlertDialog`.
- [x] Цели: баланс, `GoalCard` с `AnimatedProgress`, «Выделить/Вернуть» в `ResponsiveDialog`, форма новой цели.
- [x] Настройки: списки категорий, переименование в `ResponsiveDialog`, добавление, резервная копия.
- [x] Вход и стартовый остаток.
- [x] Переход разделов через `AnimatePresence`.
- [x] Удалить `src/styles.css`; проверка `pnpm check && pnpm build && pnpm test`.

### Task 5: Скелетоны

**Files:** `src/screens/skeletons.tsx`; `src/App.tsx` (выбор скелетона).

- [x] `HomeSkeleton`, `HistorySkeleton`, `GoalsSkeleton`, `SettingsSkeleton`, `AuthSkeleton` из тех же компонентов разметки; метки `data-sk` на основных блоках экрана и скелетона.
- [x] Показ при `authState === "checking"` (с отметкой входа — скелетон раздела) и при `!data`; перекрёстное затухание.
- [x] Проверка в браузере: сравнение `getBoundingClientRect` блоков `data-sk` экрана и скелетона на 375px и 1280px, светлая и тёмная тема, расхождение 0px.

### Task 6: Проверка сценариев и документация

- [x] Ручной прогон в браузере (локальная D1): вход, стартовый остаток, запись, исправление, удаление, цели, категории, обе темы, 375px и 1280px.
- [ ] Офлайн-режим в браузере не прогонялся: во встроенной панели нельзя отключить сеть; логика офлайна не менялась.
- [x] `ARCHITECTURE.md` — раздел «Интерфейс»; `README.md` — упоминание UI Kit при необходимости; `BACKLOG.md` — FT-17 «Готово».
- [x] Коммит.
