# FlowState

FlowState is a mobile-first planner for running a day with less friction and more clarity. The current app is built around three primary flows:

- `Today`: execute the current day from one calm agenda
- `Plan`: review and shape upcoming days
- `Tasks`: capture, sort, and schedule actionable work

Under the hood, the app still keeps robust separate models for tasks, sessions, routines, plans, and trackers. The UI is intentionally simpler than the data model so the day-to-day experience stays fast and intuitive.

## Workspace

The active app code lives in [`flowstate/`](./flowstate).

Important paths:

- [`flowstate/apps/mobile`](./flowstate/apps/mobile): Expo / React Native mobile app
- [`flowstate/packages/core`](./flowstate/packages/core): shared database, query, and sync logic
- [`flowstate/apps/mobile/android`](./flowstate/apps/mobile/android): native Android project
- [`flowstate/apps/mobile/build-android.ps1`](./flowstate/apps/mobile/build-android.ps1): local Android release build helper

## Product Shape

### Primary navigation

- `Today`
- `Plan`
- `Tasks`

### Secondary surfaces

- `More`: setup and utilities
- `Insights`: stats and analytics
- `Session Templates`: reusable timed session structures
- `Trackers`: reusable daily data/checkbox/countdown/rating inputs
- `Imported Plans`: CSV-backed plans that can now be edited in-app

### Core ideas

- A unified planner timeline mixes tasks and sessions visually while keeping them separate in storage.
- Pillars are treated as legacy metadata instead of the main navigation model.
- Session timing, restore, pause/resume, skip, complete, and debrief flows remain intact.
- Administrative power stays available, but it no longer dominates the daily workflow.

## Features

### Today

- Unified timeline for the current date
- Active session state surfaced directly in the planner
- Top priorities section
- Pinned trackers
- Fast entry points for tasks and sessions

### Plan

- Multi-day planning surface
- Date strip plus agenda for the selected day
- Scheduling and retiming of tasks and sessions
- Imported-plan content visible alongside regular planner items

### Tasks

- Inbox and scheduled task management
- Lightweight editor with priority, due date, due time, notes, and category
- Consistent form system shared with the rest of the app

### Sessions

- Template-driven timed sessions
- Multi-block timer engine
- Background-safe session restore behavior
- Debrief flow after completion

### Trackers and templates

- Session templates for reusable timed routines
- Tracker types for counts, ratings, notes, reminders, streaks, launchers, and more
- Setup flows moved out of the main day planner

### Imported plans

- CSV import
- Active plan toggling
- In-app editing of plan metadata, day content, and session scheduling

### Data and reliability

- SQLite-backed local persistence through shared core queries
- Firebase sync integration
- Backup/export surfaces
- TypeScript across app and shared logic

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript
- Zustand
- SQLite / shared query layer in `@flowstate/core`
- Firebase / Firestore sync
- Android native project under `apps/mobile/android`

## Getting Started

### Requirements

- Node.js 20+
- npm 11+ or a compatible npm that can install the lockfile cleanly
- Java 17
- Android SDK if you want to run or build Android locally

### Install

From the repo root:

```bash
cd flowstate
npm install
```

### Run the mobile app

From [`flowstate/apps/mobile`](./flowstate/apps/mobile):

```bash
npx expo start
```

Useful alternatives:

- `npx expo start --clear`
- `npx expo run:android`
- `npx expo run:ios`

### Type-check

From [`flowstate`](./flowstate):

```bash
node_modules\.bin\tsc.cmd --noEmit -p apps\mobile\tsconfig.json
node_modules\.bin\tsc.cmd --noEmit -p packages\core\tsconfig.json
node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json
```

## Android Builds

### Debug build

From [`flowstate/apps/mobile/android`](./flowstate/apps/mobile/android):

```bash
set EXPO_PROJECT_ROOT=%CD%\..
set EXPO_ROUTER_APP_ROOT=%CD%\..\app
set EXPO_NO_METRO_WORKSPACE_ROOT=1
gradlew.bat assembleDebug
```

Output:

- [`flowstate/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`](./flowstate/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk)

### Release build

The project now supports a proper upload keystore through environment variables:

- `FLOWSTATE_UPLOAD_STORE_FILE`
- `FLOWSTATE_UPLOAD_STORE_PASSWORD`
- `FLOWSTATE_UPLOAD_KEY_ALIAS`
- `FLOWSTATE_UPLOAD_KEY_PASSWORD`

If those values are not set, the Android `release` build falls back to the debug keystore for local-only packaging.

Recommended helper:

```powershell
cd flowstate/apps/mobile
.\build-android.ps1
```

Direct Gradle alternative:

```bash
cd flowstate/apps/mobile/android
set NODE_ENV=production
set EXPO_PROJECT_ROOT=%CD%\..
set EXPO_ROUTER_APP_ROOT=%CD%\..\app
set EXPO_NO_METRO_WORKSPACE_ROOT=1
set FLOWSTATE_UPLOAD_STORE_FILE=app\flowstate.keystore
set FLOWSTATE_UPLOAD_STORE_PASSWORD=your-password
set FLOWSTATE_UPLOAD_KEY_ALIAS=flowstate-upload
set FLOWSTATE_UPLOAD_KEY_PASSWORD=your-password
gradlew.bat assembleRelease
```

Release output:

- [`flowstate/apps/mobile/android/app/build/outputs/apk/release/app-release.apk`](./flowstate/apps/mobile/android/app/build/outputs/apk/release/app-release.apk)

### Generating a local keystore

Example:

```bash
keytool -genkeypair -v -keystore app\flowstate.keystore -alias flowstate-upload -keyalg RSA -keysize 2048 -validity 10000
```

Run that from [`flowstate/apps/mobile/android`](./flowstate/apps/mobile/android) or adjust the path accordingly.

## Current UX Direction

The current app direction is deliberately more restrained than earlier versions:

- fewer primary tabs
- fewer duplicated entry points
- calmer timeline-first planning
- more consistent form styling
- setup/admin tools moved behind secondary routes
- timer/session engine kept strong while the interface is simplified

## Notes

- The repo may contain legacy routes and compatibility surfaces during migration.
- Android release signing is environment-driven so secrets do not need to live in source control.
- The APK build helper script assumes a Windows development environment.

## License

Private project. All rights reserved.
