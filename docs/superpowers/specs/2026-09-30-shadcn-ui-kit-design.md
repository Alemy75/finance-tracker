# UI Kit на shadcn/ui, анимации и скелетоны (FT-17)

Дата: 2026-09-30. Запрос пользователя: перевести интерфейс на shadcn/ui, вынести примитивы в UI Kit, сделать интерфейс плавным с помощью motion, добавить скелетоны, совпадающие с контентом до пикселя, использовать иконки Feather.

## Стек

- Tailwind CSS v4 через `@tailwindcss/vite`; `src/styles.css` заменяется на `src/index.css` с темой в CSS-переменных shadcn.
- shadcn/ui (стиль new-york, Radix), `components.json`, алиас `@/*` → `src/*` в `tsconfig.app.json` и `vite.config.ts`.
- `motion` (`motion/react`) для анимаций; `vaul` для Drawer; `sonner` для уведомлений.
- Иконки Feather (MIT): типизированные React-компоненты нужных иконок генерируются в `src/components/ui/icons.tsx` из пакета `feather-icons` (dev-зависимость). `lucide-react` не используется: импорты иконок в компонентах shadcn переводятся на Feather.
- Шрифт Manrope Variable из `@fontsource-variable/manrope` с кириллицей; `woff2` добавляется в `globPatterns` workbox, чтобы шрифт работал без сети.

## Структура

- `src/components/ui/` — UI Kit. Компоненты shadcn: `button`, `card`, `input`, `label`, `textarea`, `native-select`, `badge`, `skeleton`, `dialog`, `drawer`, `alert-dialog`, `alert`, `separator`, `sonner`. Собственные примитивы: `SegmentedControl` (индикатор через `layoutId`), `ChoiceChips`, `Field` (подпись + контрол + ошибка), `MoneyInput`, `AnimatedMoney`, `AnimatedProgress`, `ResponsiveDialog` (Drawer до 760px, Dialog шире), `EmptyState`, `SectionHeading`, `SkeletonText`, `icons`.
- `src/components/app/` — прикладные компоненты: `AppShell`, `SyncStatus`, `ConflictCard`, `BalanceCard`, `TransactionRow`, `TransactionList`, `QuickEntry`, `GoalCard`.
- `src/screens/` — `Home`, `History`, `Goals`, `Settings`, `Auth`, `OpeningSetup` и скелетоны экранов.
- `App.tsx` хранит состояние, вход и синхронизацию; разметки экранов в нём нет. `finance.ts`, `localData.ts`, `sync*`, `authClient.ts` не меняются.

## Взаимодействие

- Исправление операции — `ResponsiveDialog`; удаление — `AlertDialog` вместо `window.confirm`.
- «Выделить» и «Вернуть» на цели — `ResponsiveDialog`; переименование категории — `ResponsiveDialog`.
- «Запись сохранена» — уведомление sonner. Ошибки проверки остаются под полями формы.
- Конфликты и ошибки синхронизации — `Alert` с кнопками действий.
- Тексты, проверки и порядок действий из `PRODUCT_SPEC.md` сохраняются.

## Тема «Лес»

- Светлая: фон `#f5f3ee` с мягким радиальным градиентом сверху, карточки белые, `--primary` `#1f3d36`, акцент лаймовый `#c8e87a`, токен `--income` для доходов.
- Тёмная (по `prefers-color-scheme`): фон `#101614`, карточки `#18201d`, `--primary` — лайм с тёмным текстом.
- Градиенты точечно: карточка баланса (135°, `#1f3d36` → `#2f5f52` с лаймовым свечением), лёгкий вертикальный градиент основной кнопки, полоса прогресса цели лайм → зелёный.
- `theme_color` и `background_color` PWA и `index.html` переводятся на новые цвета; иконки остаются.

## Анимации

- `MotionConfig reducedMotion="user"`.
- Переход разделов: затухание со сдвигом 6px, ~180 мс.
- Индикатор активного раздела навигации и `SegmentedControl` — общий `layoutId`.
- Строки списков: анимация появления и удаления с `layout`, без анимации при первом рендере.
- «Дополнительно» раскрывается по высоте; суммы (`AnimatedMoney`) и прогресс целей меняются плавно.
- Скелетон сменяется контентом через перекрёстное затухание.

## Скелетоны

- Скелетон экрана собирается из тех же компонентов разметки, что и экран. Текстовые элементы заменяет `SkeletonText`: тот же класс типографики, строка-образец прозрачного цвета и фон-заглушка. Высота строк, отступы и сетка совпадают автоматически.
- Показываются, пока идёт проверка входа (при наличии локальной отметки входа — скелетон текущего раздела, иначе скелетон формы входа) и пока загружается IndexedDB.
- Проверка: основные блоки экрана и скелетона помечены `data-sk`; в браузере сравниваются `getBoundingClientRect` на ширине 375px и 1280px в светлой и тёмной теме. Допустимое расхождение — 0px по высоте и вертикальной позиции блоков.

## Проверка

- `pnpm check`, `pnpm build`, `pnpm test`.
- Ручной прогон в браузере: вход, стартовый остаток, запись, исправление, удаление, цели, категории, выгрузка, офлайн-режим, обе темы, мобильная и настольная ширина.

## Документация

- `BACKLOG.md`: задача FT-17.
- `ARCHITECTURE.md`: раздел об интерфейсе и UI Kit.
