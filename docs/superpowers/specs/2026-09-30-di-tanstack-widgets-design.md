# DI, TanStack Query и виджеты (FT-19)

Дата: 2026-09-30. Запрос пользователя: перенести паттерн DI из проекта mfa, добавить TanStack Query для запросов и разбить интерфейс на виджеты. Решения пользователя: через TanStack Query идут и сеть, и IndexedDB; глобальное состояние — атомы nanostores в DI, как в mfa; новые тесты не добавляются.

## DI

- `src/lib/container.ts` — перенос `@mfa/container`: `createContainer().require().provide().override().build()`, ленивое создание сервисов, `ContainerOf`, `type<T>()`.
- `src/lib/di.ts` — `createDi()`; `export type Di = ContainerOf<ReturnType<typeof createDi>>`. Требует `queryClient` и `captureException`, предоставляет `httpClient`, `localDb`, `deviceId`, сервисы запросов и мутаций, атомы и `syncEngine`.
- `main.tsx` собирает контейнер и рендерит `<App di={di} />`. Компоненты получают `di` только через пропсы и не обращаются к `fetch`, IndexedDB, localStorage и модулям авторизации напрямую. `finance.ts` остаётся набором чистых функций.

## Запросы

- `src/api/<сервис>/` по образцу `@mfa/bff-api`: `config.ts` (ключ запроса), `query.ts` (фабрика `createX(deps)`, которая возвращает функцию с `.qo()` для запросов или `.mo()` для мутаций), `index.ts`.
- Сеть: `getAccountStatus`, `getHealth`, `signIn`, `signUp`, `signOut`, `exportBackup` (через `syncEngine`).
- Локальные данные: `getLocalData`, `getOutbox` (`networkMode: "always"`, `staleTime: Infinity`); мутации `saveOpeningBalance`, `saveTransaction`, `updateTransaction`, `deleteTransaction`, `createCategory`, `renameCategory`, `createGoal`, `moveGoalMoney`, `resolveConflict`. Мутация проверяет данные по текущему кэшу, пишет в IndexedDB, обновляет кэш через `setQueryData`, обновляет очередь и запрашивает синхронизацию.

## Глобальное состояние

- `$page`, `$online`, `$authMarker` (`@nanostores/persistent`), `$accountStatus` (`queryAtom`, перенос из `@mfa/nanostores`), вычисляемые `$authState` и `$connection`.
- `syncEngine`: атом `$sync` (`syncing`, `checked`, `error`), `request()`, `exportBackup()`, `watch()` для подписки на `online` и `visibilitychange`. При ответе «Сессия завершилась» сбрасывает `$authMarker` и перезапрашивает статус входа.
- Компоненты читают атомы через `@nanostores/react`.

## Слои компонентов

| Слой | Может использовать | DI | Данные |
| --- | --- | --- | --- |
| `components/ui` | ui | нет | только пропсы |
| `components/smart` | ui, smart | да | сущность передаёт родитель |
| `components/widgets` | ui, smart, widgets | да | сам получает свои данные |
| `components/pages` | ui, smart, widgets | да | только компоновка экрана |

- Виджет: `components/widgets/<kebab-name>/` с `Name.tsx`, `NameSkeleton.tsx` (если есть загрузка), `types.ts` (пропсы с `di`), `index.ts`.
- Виджеты: `app-layout`, `sync-status`, `balance`, `home-goals`, `quick-entry`, `month-expenses`, `recent-operations`, `history`, `goals`, `new-goal`, `categories`, `backup`, `auth`, `opening-setup`.
- Smart: `goal-card`, `edit-operation-form`, `transaction-row`, `transaction-list`, `category-breakdown`.
- Страницы: `home`, `history`, `goals`, `settings`; отступы между виджетами задаёт страница.

## Скелетоны

- Примитив `SkeletonSwap` кладёт скелетон и контент в одну ячейку грида и сменяет их перекрёстным затуханием. В режиме разработки `?skeleton` он показывает скелетон поверх контента.
- Виджет показывает свой скелетон, пока его данные не прочитаны или пока страница передала `skeleton` (проверка входа). Форма скелетона берётся из локальных данных, если они есть.

## Ошибки

- Непредвиденные ошибки — `di.captureException(new Error("[Источник] контекст: описание", { cause }))`; сейчас реализация пишет в `console.error`. Сообщения для пользователя не меняются.

## Проверка

- `pnpm check`, `pnpm build`, `pnpm test`; ручной прогон в браузере и сверка скелетонов через `?skeleton` на 375px и 1280px.
