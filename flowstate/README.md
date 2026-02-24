# FlowState

A structured daily planning & habit tracking app. Plan days, run timed sessions, track modules (countdowns, checkboxes, ratings, data inputs, streaks), and review weekly analytics — all from your phone or desktop.

## Architecture

```
flowstate/
├── apps/
│   ├── mobile/      Expo React Native (SDK 54) + expo-router
│   └── desktop/     Vite + React + Electron
├── packages/
│   └── core/        Shared logic: DB, types, timer, CSV, Firebase, analytics, narrative
├── turbo.json       Turborepo config
└── package.json     npm workspaces root
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo SDK 54, React Native 0.81, expo-router 6 |
| Desktop | Vite, React 19, Electron |
| Database | expo-sqlite + Drizzle ORM (mobile), better-sqlite3 (desktop) |
| State | Zustand 5 |
| Auth/Sync | Firebase 12 (Auth + Firestore) |
| Charts | react-native-svg (custom sparklines) |
| Build | Turborepo, TypeScript 5.9 |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- [Expo Go](https://expo.dev/go) on your phone (for dev testing)

### Install

```bash
git clone <repo-url> && cd flowstate
npm install
```

### Run Mobile (dev)

```bash
cd apps/mobile
npx expo start
```

Scan the QR code with Expo Go or press `w` for web.

### Run Desktop (dev)

```bash
cd apps/desktop
npm run dev          # Vite dev server
# In another terminal:
npx electron .       # Electron window
```

## Project Structure

### `packages/core`

Shared business logic imported by both apps as `@flowstate/core`.

| Module | Purpose |
|--------|---------|
| `db/schema.ts` | Drizzle ORM table definitions (8 tables) |
| `db/queries.ts` | Full CRUD: plans, day-plans, modules, sessions, CSV import |
| `db/analytics.ts` | Aggregates: compliance rates, rating trends, session stats, streaks, plan progress |
| `types/` | TypeScript types + Zod schemas for ModuleSpec, DayPlan, Session, TimerState |
| `timer/TimerEngine.ts` | Timestamp-based timer with play/pause/resume/skip/end |
| `csv/parser.ts` | Pure-JS RFC-4180 CSV parser (no Node.js deps) |
| `firebase/` | Firebase Auth + Firestore sync |
| `narrative/index.ts` | Template-based weekly summary text generator |

### `apps/mobile`

Expo Router file-based routing:

| Route | Screen |
|-------|--------|
| `(tabs)/index` | Home — live modules, today snapshot, daily log |
| `(tabs)/today` | Today checklist & modules |
| `(tabs)/plan` | Plan view with progress analytics + heatmap |
| `day/[date]` | Day detail — must-dos, modules, sessions, quiet day toggle |
| `week/[weekId]` | Week summary — narrative, stats, compliance bars, trend charts |
| `session/[id]` | Timer screen with SVG ring + block controls |
| `modules/` | Module list, create wizard, detail pages |
| `import/` | CSV import flow (pick → preview → success) |
| `settings` | App settings — notifications, haptics, data management |

### Module Types

9 module types, each with its own card component:

- **Countdown** — days until target date, with optional intention field
- **Countup** — days since origin (standard or "last seen" variant)
- **Checkbox** — daily yes/no toggle
- **Rating** — 1–5 star scale
- **Data Input** — numeric tracking with target
- **Text Note** — free-text daily capture
- **Progress Bar** — date-range visual progress
- **Streak Counter** — consecutive completion tracker
- **Group** — container for related modules

## Analytics (Phase 6)

The analytics layer (`packages/core/src/db/analytics.ts`) provides:

- **Checkbox Compliance** — % of days each habit was checked
- **Rating Trends** — averages with week-over-week trend direction
- **Data Input Stats** — sum, average, days on target
- **Session Completion** — completed/abandoned/pending with daily breakdown
- **Streak Calculations** — current + best streaks
- **Must-Do Stats** — daily completion rates
- **Weekly Aggregate** — all of the above combined for a date range
- **Plan Progress** — overall plan completion with heatmap data

The narrative generator (`packages/core/src/narrative/`) turns weekly aggregates into a natural-language summary paragraph.

## Building for Production

### Mobile (EAS Build)

```bash
cd apps/mobile
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

Config: `apps/mobile/eas.json`

### Desktop (Electron)

```bash
cd apps/desktop
npm run electron:build          # Current platform
npm run electron:build:mac      # macOS
npm run electron:build:win      # Windows
npm run electron:build:linux    # Linux
```

Config: `apps/desktop/electron-builder.json`

## Design System

Minimalist Notion/Linear aesthetic with iOS polish:

- **Colors**: Neutral-first palette, single accent (#2563EB)
- **Typography**: System font, 7 size tokens (xs → hero)
- **Spacing**: 6 tokens (xs=4 → xxl=48)
- **Animation**: 150–220ms spring transitions
- **Haptics**: Light for toggles, Medium for destructive actions
- **Icons**: Feather set via @expo/vector-icons

## License

Private — all rights reserved.
