# ∞ Melodies — план выхода на 1.0

**Статус:** реализовано в 1.0.0 (4 ноября 2026)
**Дата:** 4 ноября 2026
**База:** 1.0.0 (`main`), 60 unit-тестов, production build проверен
**Фокус:** информационная архитектура и UX, а не новые генеративные фичи

**Фактически в 1.0.0:** IA-критерии выполнены, 60 unit-тестов; e2e/axe и поле имени проекта отложены на 1.0.x. Playwright-сценарии не входили в релиз.

**Решения владельца (4 ноября):**

- Staff notation — опциональный toggle в инспекторе, выключен по умолчанию.
- Смена жанра — полный сброс проекта с Undo.
- Инспектор — панель (справа на desktop, сворачиваемая над треками на мобильном).
- Ритм — глобальный; на каждом треке кнопки `½ / 1× / 2×`.
- RU/EN исключён; интерфейс только на английском.
- 1.0 идёт в GitHub сразу рабочей версией.

---

## 0. Коротко

Гипотеза верна: **две вкладки Harmony / Arrangement больше не окупаются**. Они заставляют переключать контекст там, где продюсеру нужен один непрерывный поток «прогрессия → аранжировка → экспорт», и одновременно раздувают каждый экран: в Harmony живут настройки, палитра, клавиатура и нотный стан, а в Arrangement — те же синты, ритм и глобальные действия.

Предлагаю к 1.0:

1. **Убрать вкладки.** Один рабочий экран «Studio».
2. **Верхний Project Bar** с быстрыми контролами: `Key: A minor ▾`, `Genre: House ▾`, `BPM`, `Project ▾`.
3. **Progression Strip** — горизонтальная полоса аккордов над дорожками. Всегда видна, редактируется на месте, без отдельного экрана.
4. **Инспектор справа (на мобильном — bottom sheet)**: выбранный аккорд, ноты, пиано-клавиатура и **опциональный** нотный стан.
5. **Нотный стан убрать из основного экрана.** Оставить как выключенный по умолчанию переключатель `Notation` в инспекторе (код уже lazy, 387 КБ gzip не грузятся, пока его не открыть). Альтернатива — вообще убрать в 1.0 и вернуть как экспорт MusicXML/PDF позже.
6. **Настройки проекта — двухуровневые:** частые параметры (key/genre/BPM) всегда на виду, редкие (complexity, rhythm, project name, save/open) — в `Project ▾`.
7. **Глобальные Undo/Redo** в шапке вместо двух независимых историй (аккорды и мелодии).

Оценка работ: **~20–25 человеко-дней**, 5 итераций, релиз 1.0 через ~5 недель. Новые фичи (мотивы, подсказки гармонии, MIDI-импорт) — после 1.0.

---

## 1. Что не так сейчас

### 1.1 Вкладки разрывают рабочий процесс

Сейчас `App.tsx` содержит два `role="tabpanel"` (`App.tsx:636–792`). Поток выглядит так:

```
Harmony: настройки + прогрессия + клавиатура + стан + палитра
   ⇅ переключение вкладки (звук продолжается, но контекст теряется)
Arrangement: секции + 4 дорожки + генераторы + экспорт
```

Проблемы:

- **Дублирование.** Синт аккордов выбирается и в Harmony (`SynthSelector`), и в дорожке Chords. Ритм-паттерн — глобальный, но лежит только в Harmony, хотя влияет на аранжировку. Undo/Redo есть в обеих вкладках, но это две разные истории.
- **Разные центры тяжести.** В Harmony три визуализации (карточки, пиано, стан) и палитра занимают 2/3 экрана, при этом главное действие — «собрать прогрессию» — тонет в настройках.
- **Переключение ради одного параметра.** Чтобы поменять BPM, послушать и вернуться к дорожкам, нужно уйти с Arrangement (BPM теперь в шапке, но ритм и complexity — нет).
- **Мобильный порядок.** На Harmony сначала идут визуализации, потом настройки в один столбец: до выбора жанра/тональности нужно проскроллить.

### 1.2 Нотный стан — самая дорогая и самая узкая по аудитории часть

- `StaffNotation` — отдельный lazy-chunk **387 КБ gzip** (VexFlow, одна фонтовая сборка).
- Для EDM-продюсера стан редко является рабочим инструментом: аккорды читаются по именам и пиано-роллу, MIDI уходит в DAW.
- На мобильном стан всё равно скроллится внутри карточки (600–680 px), то есть занимает место, но не помещается.
- При этом стан — единственное «теоретическое» представление; полностью удалять его в 1.0 рискованно.

**Решение:** убрать из первого экрана, оставить опциональным в инспекторе (`Notation` off by default). Это сохраняет ценность для тех, кому надо, и не грузит 387 КБ остальным.

### 1.3 Настройки проекта размазаны

| Параметр | Где сейчас | Проблема |
|---|---|---|
| Key / Scale | левая колонка Harmony | не видно в Arrangement |
| Genre | левая колонка Harmony | смена жанра сбрасывает часть состояния |
| BPM | шапка | ок, но меняется вне контекста проекта |
| Complexity | левая колонка Harmony | влияет на палитру, спрятан |
| Rhythm pattern | левая колонка Harmony | влияет на Chords-дорожку |
| Synth | Harmony + Chords | дубль |
| Templates | отдельный блок | занимает много места |
| Project name | нигде | нельзя назвать проект до сохранения |

### 1.4 Технический вес экранов

- `App.tsx` — 833 строки, `MelodyStudio.tsx` — 1299, `lanes.tsx` — 471.
- Две независимые истории (аккорды в App, мелодии в MelodyStudio).
- Много вертикального пространства: секции + groove + 4 дорожки + генераторы + velocity + подсказки.

---

## 2. Принципы 1.0

1. **Один экран — один поток.** Harmony и Arrangement — не режимы, а зоны одного рабочего пространства.
2. **Прогрессия всегда перед глазами.** Это якорь проекта; её нельзя прятать за вкладкой.
3. **Progressive disclosure.** Частые действия — на поверхности; теоретические и редкие — в `Project ▾` / `Advanced`.
4. **Никакого «переведённого» интерфейса.** Английские профессиональные термины (key, scale, progression, arrangement, stems, count-in), без RU/EN.
5. **Плотность важнее воздуха.** Больше информации на экране, меньше декоративных отступов.
6. **Один undo.** Одна история на проект, один `Cmd/Ctrl+Z`.
7. **Сначала стабильность.** 1.0 — это не «ещё десять генераторов», а предсказуемый инструмент.
8. **Touch-first.** 44 px, никаких hover-only действий, bottom sheets на мобильном.

---

## 3. Целевая информационная архитектура

### 3.1 Общая схема

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ∞ Melodies v1.0        Key: A minor ▾   Genre: House ▾   [Project ▾]         │  Project Bar
│ [▶] 12/32  BPM 124  Loop  Click  Count-in  Vol ────  [Undo][Redo] [Share]   │  Transport
├──────────────────────────────────────────────────────────────────────────────┤
│ PROGRESSION   [Am] [F] [Dm] [Em]  + Add chord     Template ▾   Basic ▾       │  Progression Strip
├──────────────────────────────────────────────────────────────────────────────┤
│ SONG SECTIONS  [Intro 4] [Build 8] [Drop 8] [Break 4] [Outro 4]  Edit ▾     │  Collapsible
├───────────────────────────────────────────────┬──────────────────────────────┤
│ TRACKS                                        │ INSPECTOR                    │
│ ┌───────────────────────────────────────────┐ │ Fmaj7                       │
│ │ ▸ CHORDS   [Piano ▾]  ▮▮▮  M S  ▶         │ │ F A C E  ·  IV              │
│ │   [chord blocks + playhead]               │ │ [piano keyboard]            │
│ │   Rhythm [Straight ▾]  Complexity [Basic] │ │ [Notation]  (off)           │
│ ├───────────────────────────────────────────┤ │ Notes / intervals           │
│ │ ▸ BASS     [Pluck ▾]  ▮▮▮  M S  ▶         │ │ Add chord ▾                 │
│ │   [piano roll] [velocity] [density/idea]  │ ├──────────────────────────────┤
│ ├───────────────────────────────────────────┤ │ PROJECT                     │
│ │ ▸ LEAD     [Supersaw ▾] ▮▮▮ M S ▶         │ │ House · A minor · 124 BPM   │
│ ├───────────────────────────────────────────┤ │ Save / Open / Export        │
│ │ ▸ DRUMS    [909 ▾]     ▮▮▮  M S  ▶        │ │                             │
│ └───────────────────────────────────────────┘ │                             │
└───────────────────────────────────────────────┴──────────────────────────────┘
```

### 3.2 Почему Project Bar, а не «всё в одном dropdown»

Полностью спрятать key/genre/BPM в меню — значит добавить клик к самым частым действиям. Поэтому два уровня:

**Всегда видимы (Project Bar):**

- `Key: A minor ▾` — сгруппированный выбор тональности и лада (A minor, A major, A Dorian…).
- `Genre: House ▾` — с цветовой точкой жанра и подсказкой BPM-диапазона.
- `BPM` — уже в транспорте, оставить там.
- `Project ▾` — имя проекта, save/open/new, export, share, настройки.

**В `Project ▾` (редкие/административные):**

- Project name.
- Complexity (Basic / 7ths / 9ths / Jazzy).
- Default rhythm (или ссылка на ритм Chords-дорожки).
- Save project / Open project / New project.
- Export (MIDI / WAV / Stems / JSON).
- Share link.
- (Later) tempo range, swing default, count-in default.

Это сохраняет discoverability частых параметров и убирает простыню настроек из основного экрана.

### 3.3 Progression Strip

Горизонтальная полоса под транспортом:

- карточки аккордов: имя, римская цифра, индикатор выбранного;
- drag-to-reorder (desktop), `←/→` для клавиатуры;
- `+ Add chord` открывает popover с аккордами текущей тональности и complexity;
- `Template ▾` — 5 жанровых шаблонов (вместо блока на пол-экрана);
- `Basic ▾` (complexity) — рядом, если хочется менять на месте;
- клик по карточке выбирает аккорд → инспектор; повторный клик/кнопка `✕` удаляет (или `Delete`).

Стрип остаётся видимым на всех размерах; на мобильном — горизонтальный скролл, без переноса.

### 3.4 Инспектор

Назначение: заменить три разрозненных блока Harmony (piano, staff, chord detail, palette) одним контекстным местом.

Содержимое при выбранном аккорде:

- Название, римская цифра, тип, интервалы.
- Ноты (чипы) и пиано-клавиатура.
- `Notation` — toggle, **по умолчанию off**. При включении подгружается VexFlow и показывается стан; при выключении — выгружается из DOM.
- `Add chord` / `Remove` / inversion controls.
- Для выбранной ноты/дорожки (later): velocity, range, density — но в 1.0 инспектор только про аккорд.

На ≥1280 px — фиксированная правая колонка 320–360 px. На <1280 — bottom sheet по клику на аккорд, с drag-handle и кнопкой Close.

### 3.5 Секции и дорожки

- Секции — сворачиваемая полоса над дорожками. По умолчанию развёрнута, если секции есть; если нет — одна строка `Song sections · Loop progression  [Create structure]`.
- Четыре дорожки остаются, но в 1.0 уплотняются: заголовок 48 px, лейн 72–96 px, вторичные контролы (density/idea/velocity) — в раскрывающейся строке, не постоянно.
- Chords-дорожка получает `Rhythm ▾` и `Complexity ▾` (вместо левой колонки Harmony).
- Synth остаётся только в дорожке; глобальный `SynthSelector` из Harmony удаляется.

### 3.6 Мобильный layout

```
┌───────────────────────────┐
│ ∞ Melodies   A minor ▾  ▾ │  compact project bar
│ ▶ 1/4  124  Loop  Click   │  transport (wrap)
├───────────────────────────┤
│ [Am][F][Dm][Em]  +        │  progression strip (horizontal)
├───────────────────────────┤
│ ▾ CHORDS  [Piano▾] M S ▶  │  expanded
│   [chord blocks]          │
│ ▸ BASS                    │  collapsed
│ ▸ LEAD                    │
│ ▸ DRUMS                   │
├───────────────────────────┤
│ [Inspector]  [Project ▾]  │  bottom dock
└───────────────────────────┘
```

- Project settings — full-screen sheet.
- Inspector — bottom sheet.
- Вкладки отсутствуют.
- Основные цели ≥44 px.

---

## 4. Куда переезжает каждая функция Harmony

| Harmony сейчас | Куда в 1.0 | Комментарий |
|---|---|---|
| Key / Scale | Project Bar → `Key: A minor ▾` | сгруппированный список; транспонирует custom-прогрессию |
| Genre | Project Bar → `Genre: House ▾` | цветовая точка, BPM-подсказка; смена жанра по-прежнему предлагает шаблон |
| BPM | Transport | без изменений |
| Chord complexity | Project Bar рядом с шаблоном + `Project ▾` | влияет на палитру и шаблон |
| Progression templates | Progression Strip → `Template ▾` | 5 шаблонов в popover, не блок |
| Rhythm pattern | Chords track → `Rhythm ▾` | он относится к аккордовой дорожке |
| Synth | Chords track only | убрать дубль из Harmony |
| Chord cards | Progression Strip | выбранный → инспектор |
| Piano keyboard | Inspector | не занимает место постоянно |
| Staff notation | Inspector → `Notation` (off) | lazy; по умолчанию не грузится |
| Chord palette | `+ Add chord` popover | компактнее постоянной сетки |
| Inversions / voice leading | Inspector + контекстное меню аккорда | не три кнопки на каждой карточке |
| Undo/Redo | Header, глобальные | одна история |
| Reset to template | Progression Strip menu | с подтверждением/undo |

---

## 5. Решение по нотному стану

**Рекомендация: оставить, но вынести за пределы первого экрана.**

Аргументы «за удаление»:

- 387 КБ gzip в отдельном чанке, низкая частота использования в EDM;
- на мобильном стан не помещается;
- занимает треть экрана Harmony.

Аргументы «за сохранение»:

- уникальная ценность для теории/образования;
- уже реализован и протестирован;
- стоит один toggle, если lazy.

**Компромисс для 1.0:**

- `Notation` выключен по умолчанию.
- При включении стан грузится (`React.lazy` уже есть) и показывается в инспекторе.
- При выключении — `Suspense` не монтируется, чанк не грузится.
- В `Project ▾ → Export` позже можно добавить `MusicXML`/`PDF`, но не в 1.0.
- Если после 1.0 окажется, что им не пользуются, удалить код в 1.1 без сожаления.

**Не делать в 1.0:** встраивать стан в основной поток, делать его обязательным или переносить в отдельную вкладку.

---

## 6. Wireframes и размеры

### 6.1 Desktop ≥1280

```
header 56  | project bar + transport (2 строки)
progression 72
sections 48 (collapsed) / 96 (expanded)
tracks 4 × 160 = 640
footer 40
```

- Инспектор 320–360 px, sticky, скроллится независимо.
- Треки — `min-w-0`, лейны на всю ширину.
- При 1024–1279 инспектор уезжает в bottom sheet, треки на всю ширину.

### 6.2 Tablet 834

- Project Bar в одну строку с горизонтальным скроллом, если не влезает.
- Progression strip с горизонтальным скроллом.
- Inspector — sheet.
- Секции — collapsed по умолчанию.

### 6.3 Mobile 390

- Project bar: две строки (brand + key/genre; transport).
- Progression strip — 56 px высотой.
- Tracks — аккордеон: одна раскрыта.
- Bottom dock: `Inspector` / `Project` кнопки.
- Нет горизонтального скролла страницы; только внутри лейнов/стрипов.

---

## 7. Компоненты и рефакторинг

### 7.1 Новые компоненты

| Компонент | Ответственность |
|---|---|
| `ProjectBar` | key/scale, genre, project menu, BPM-связка |
| `ProjectMenu` | название, save/open/new, export, share, complexity |
| `ProgressionStrip` | карточки, add chord, template menu, reorder |
| `Inspector` | chord detail, piano, notation toggle, palette popover |
| `BottomSheet` | мобильные настройки/инспектор, focus trap, drag handle |
| `TrackAccordion` | мобильное сворачивание дорожек |
| `Toast` / `Menu` / `Modal` | уже есть, переиспользовать |

### 7.2 Что удаляется/меняется

- Удалить `role="tablist"` и `role="tabpanel"` из `App.tsx`; состояние `activeTab` убрать из PersistedState (с миграцией).
- `KeySelector` + `GenreSelector` → компактные `Select` в ProjectBar (не отдельные панели).
- `SynthSelector` из Harmony удалить; оставить `TrackHeader` select.
- `ChordDisplay` разбить на `ProgressionStrip` + `Inspector`.
- `ChordPalette` → `AddChordPopover`; инверсии/удаление — в inspector.
- `StaffSection` → `InspectorNotation` с toggle.
- `RhythmSelector` → компактный `RhythmMenu` в Chords track (список с step-превью).
- `App.tsx` разбить на `StudioShell` + `useProjectState` + `useTransport`.
- Объединить истории: `useHistory<ProjectSnapshot>` или отдельные, но с единым API `undo/redo` в шапке.

### 7.3 Состояние

- Убрать `activeTab`.
- Добавить `selectedChordIndex` (уже есть), `inspectorOpen`, `projectMenuOpen`.
- Persist: key/scale/genre/complexity/rhythm/volume/metronome/count-in + custom progression; без activeTab.
- Project name: новое поле в snapshot и persisted state; по умолчанию `Untitled`.
- Undo: единый стек с типизированными действиями (chord edit, melody edit, mixer, sections); или минимум — объединить два текущих стека в один facade.

---

## 8. Объём 1.0 (in / out)

### Входит

- Перестройка IA: один экран, Project Bar, Progression Strip, Inspector.
- Удаление вкладок; нотный стан — опционально.
- Перенос synth/rhythm/complexity.
- Глобальные Undo/Redo.
- Мобильные sheets/аккордеон.
- Единый проект: имя, save/open/new, автосейв-индикатор.
- Onboarding: 3 шага (Key/Genre → прогрессия → Arrangement), пустые состояния.
- A11y: focus trap в sheets, 44 px, aria для меню.
- E2E smoke (Playwright): load → change key → add chord → play → export.
- Перф-бюджет: initial JS ≤ 250 КБ gzip без notation; VexFlow только по toggle.
- Баг-баш и документация.

### Не входит (после 1.0)

- Мотивы/вариации, call-response, contour (F3 remainder).
- Harmony 2.0: подсказки следующего аккорда, borrowed, secondary dominants.
- MIDI-импорт, MusicXML/PDF.
- Облако/аккаунты, коллаборация.
- RU/EN — исключён по решению владельца.
- Секции с автоматизацией параметров, song mode beyond current.

---

## 9. План работ

### M0. Прототип и решения (2–3 дня)

- Статический прототип Project Bar + Progression Strip + Inspector (HTML или Figma).
- Проверить на 1440 / 1024 / 390.
- Зафиксировать: staff optional, rhythm в Chords, complexity в Project Bar, project name.
- **Выход:** согласованный макет, список компонентов.

### M1. Shell без вкладок (5–7 дней)

- `StudioShell`, ProjectBar, удаление `tablist`.
- Progression Strip на базе текущего `ChordDisplay`.
- Inspector с piano; staff toggle (lazy).
- Всё остальное временно остаётся в старых местах, чтобы не потерять функции.
- **DoD:** один экран, прогрессия видна, play/stop не прерывается, staff не грузится по умолчанию.

### M2. Перенос настроек и палитры (3–4 дня)

- Key/Genre/Complexity/Rhythm/Template в новые места.
- `+ Add chord` popover вместо палитры.
- Удаление глобального synth.
- **DoD:** в Harmony-зоне не осталось дублирующих контролов; все параметры доступны ≤2 клика.

### M3. Мобильный UX (3–4 дня)

- Bottom sheets, accordion, sticky project bar.
- Проверка 320/360/390/414/834/1440.
- **DoD:** нет горизонтального скролла, все цели ≥44, инспектор и настройки открываются как sheets.

### M4. Undo, проект и надёжность (3–4 дня)

- Единый undo/redo, project name, autosave indicator.
- Миграция persisted state (удаление activeTab).
- Ошибки/пустые состояния.
- **DoD:** `Cmd/Ctrl+Z` отменяет и аккорды, и мелодии; проект переживает reload; нет регрессий.

### M5. Стабилизация и 1.0 (3–4 дня)

- Playwright smoke, axe, перф-бюджет.
- Документация, CHANGELOG 1.0, README.
- Баг-баш, релиз.
- **DoD:** все P0/P1 закрыты, CI зелёный, live обновлён, тесты ≥70 unit + 5 e2e.

**Итого:** 16–22 дня + буфер 20–25.

---

## 10. Критерии приёмки 1.0

| Область | Критерий |
|---|---|
| IA | Нет вкладок; прогрессия, секции, дорожки и инспектор на одном экране |
| Быстрый доступ | Key и Genre меняются в 1 клик; complexity/rhythm — ≤2 |
| Staff | Не входит в initial bundle; включается toggle в инспекторе |
| Undo | Один `Cmd/Ctrl+Z` для аккордов, мелодий, микшера |
| Мобильный | 320–414: `scrollWidth == clientWidth`; все primary-цели ≥44 px |
| Плотность | 4 дорожки + прогрессия на 1440×900 без скролла (или с минимальным) |
| Проект | Имя, Save/Open/New, автосейв-индикатор |
| A11y | axe: 0 critical/serious; sheets с Esc/focus trap |
| Перф | initial JS ≤ 250 КБ gzip; VexFlow только по toggle |
| Качество | unit ≥70, e2e 5 сценариев, CI зелёный |
| Стабильность | 0 P0/P1 на релиз |

---

## 11. Риски и митигации

| Риск | Вероятность | Митигация |
|---|---|---|
| Удаление вкладок «прячет» функции | высокая | Project Bar + привычные места; onboarding; поиск по настройкам (later) |
| Инспектор перегружен | средняя | только аккорд в 1.0; остальное — в дорожках |
| Нотный стан нужен части пользователей | средняя | toggle off by default, lazy; вернуть как экспорт позже |
| Рефакторинг ломает аудио/плейбек | средняя | не трогать движки в M1–M3; feature flag; e2e |
| Мобильные sheets конфликтуют с транспортом | средняя | bottom dock, safe-area, z-index правила |
| Вертикальный скролл вырос | средняя | свернуть секции/вторичные контролы, компактные заголовки |
| GitHub Actions/Pages недоступны | текущая | релиз 1.0 гейтится восстановлением CI; локальные артефакты готовы |

---

## 12. Решения по открытым вопросам

1. **Staff:** оставлен опциональным toggle в инспекторе, off by default. VexFlow грузится только при включении.
2. **Project name:** в 1.0 не добавлялся; проект сохраняется как JSON с именем `key-genre-bpm`. Поле имени — после 1.0.
3. **Genre change:** полный сброс проекта; Undo доступен в тосте и в шапке.
4. **Rhythm:** глобальный, управляется из Chords track; на каждом треке — `½ / 1× / 2×`.
5. **Inspector:** фиксированная панель справа на desktop; на мобильном — сворачиваемая панель над треками.
6. **1.0 freeze:** подтверждён; мотивы, гармония 2.0, импорт — после 1.0.

**Отличия реализации от черновика:** отдельного `Project ▾` меню нет — Save/Export/Share и Undo/Redo остались в шапке, а настройки проекта вынесены в Project Bar. Проектное имя отложено.

---

## 13. После 1.0 (backlog)

**Сделано в 1.2.0:** мотив/вариации, contour, call-response, 808 glide, suggest next (diatonic/borrowed/secondary), detect key, pin chord.

**Сделано в 1.3.0–1.3.2:** гибридный сэмпл-пак, Acoustic/EDM, офлайн-кэш сэмплов, sample-based WAV/stems, 6 инструментов на дорожку.

**Сделано в 1.4.0:** 7 барабанных дорожек, классические DnB/Dubstep паттерны, осмысленный Regenerate, drum-safe `2×`.

**Осталось:** MIDI-in, loop region, DAW pack, project library, e2e/axe, Safari delay, MusicXML/PDF, velocity-слои.

- **Generator 2.0+:** мотивы/вариации, call-response, contour, 808 glide.
- **Harmony 2.0:** подсказки следующего аккорда, borrowed, secondary dominants, key detection.
- **Practice:** tap tempo, Web MIDI input, computer keyboard as piano, loop region.
- **Export:** MusicXML/PDF notation, DAW pack с README, MIDI import.
- **Platform:** PWA update prompt, install onboarding, performance budget в CI.
- **Library:** версии проектов, теги, поиск, импорт/экспорт коллекции.

---

## Приложение A. Карта текущих файлов

| Файл | Строк | Что меняется |
|---|---|---|
| `src/App.tsx` | 833 | убрать вкладки, ProjectBar, ProgressionStrip, Inspector, глобальный undo |
| `src/components/MelodyStudio.tsx` | 1299 | разбить на TrackList/TrackRow, убрать дубли, compact controls |
| `src/components/ChordDisplay.tsx` | 102 | разделить на strip и inspector |
| `src/components/ChordPalette.tsx` | 161 | add-chord popover |
| `src/components/StaffNotation.tsx` | 107 | только inspector toggle |
| `src/components/KeySelector.tsx` / `GenreSelector.tsx` | 49 / 32 | компактные select в ProjectBar |
| `src/components/RhythmSelector.tsx` | 43 | rhythm menu в Chords track |
| `src/components/SynthSelector.tsx` | 54 | удалить из Harmony |
| `src/components/SectionsTimeline.tsx` | 200 | collapsible strip |
| `src/components/lanes.tsx` | 471 | компактные лейны, velocity/generator disclosure |
| `src/utils/persistence.ts` | ~270 | project name, миграция activeTab |
