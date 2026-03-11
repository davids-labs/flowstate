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
# FlowState

A structured daily planning & habit tracking app for mobile and desktop. Plan your days, run timed sessions, track habits and goals, and review analytics—all seamlessly synced across devices.

---

## Features & How to Use Them

### 1. Daily Planning
- **Create Plans:** Add day plans, must-do tasks, and routines.
- **View Today:** See your daily checklist and modules on the Today screen.
- **Edit Days:** Tap a day to add/edit must-dos, modules, or toggle “quiet day.”

### 2. Habit & Module Tracking
- **Module Types:**  
	- Countdown: Track days until a target date.
	- Countup: Track days since an origin date.
	- Checkbox: Daily yes/no toggle.
	- Rating: 1–5 star scale.
	- Data Input: Numeric tracking with target.
	- Text Note: Free-text daily capture.
	- Progress Bar: Visual date-range progress.
	- Streak Counter: Consecutive completion tracker.
	- Group: Container for related modules.
- **Create Modules:** Use the module wizard to add new habits/goals.
- **Log Data:** Tap module cards to log/check/enter values.

### 3. Timed Sessions
- **Start Session:** Launch a session from the plan or module.
- **Timer Screen:** Visual timer ring, block controls, haptics.
- **Session Events:** Pause, resume, skip, or end sessions.

### 4. Analytics & Review
- **Weekly Summary:** See compliance rates, streaks, rating trends, session stats, and plan progress.
- **Narrative Generator:** Get a natural-language summary of your week.
- **Heatmaps:** Visualize plan completion and habit consistency.

### 5. Data Management
- **Export Data:** Export your full database as JSON (Settings > Backup & Restore > Export Backup).
- **Import Data:** Restore your database from a backup JSON file (Settings > Backup & Restore > Import Backup).
- **Import Plan:** Import a CSV training plan (Settings > Import Plan).
- **Raw SQL Queries:** Run custom SQL queries for advanced inspection (Settings > Raw SQL).

### 6. Sync & Cross-Device Usage
- **Cloud Sync:** Sync data across devices using Firebase (Settings > Cloud Sync).
- **UID Transfer:** Copy your UID to link devices manually.
- **Manual Export/Import:** Move data between devices using backup files.

### 7. Customization & Settings
- **Dark Mode:** Toggle dark theme.
- **Notifications:** Enable/disable reminders.
- **Haptics:** Enable/disable vibration feedback.
- **Advanced:** Keep screen awake, confirm before delete, compact cards.

### 8. Desktop App
- **Electron App:** All features available on desktop, with IndexedDB persistence.
- **Backup & Restore:** Export/import full database as JSON.

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Expo Go app (for mobile dev)

### Install & Run
```bash
git clone <repo-url> && cd flowstate
npm install
```
**Mobile:**  
```bash
cd apps/mobile
npx expo start
```
**Desktop:**  
```bash
cd apps/desktop
npm run dev
npx electron .
```

---

## Project Structure

- `apps/mobile`: Expo React Native app
- `apps/desktop`: Vite + React + Electron app
- `packages/core`: Shared logic (DB, types, timer, CSV, Firebase, analytics, narrative)

---

## Design System

- Neutral palette, single accent (#2563EB)
- System font, 7 size tokens
- Minimalist UI, iOS polish
- Feather icons

---

## License

Private — all rights reserved.
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
