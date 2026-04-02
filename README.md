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
- `Tracker Library`: folder-first home for reusable trackers
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
- Typed tracker engine shared by `Today`, the tracker library, detail screens, and analytics
- Tracker kinds for habits, ratings, metrics, counters, notes, photos, countdowns, streaks, prompts, aggregates, and more
- Folder-based organization plus per-surface pinning and optional quick actions
- Attached schedules and reminders stored alongside each tracker
- Detail screens with quick logging, recent history, overlay charts, and archive controls
- Setup flows moved out of the main day planner and into the dedicated tracker library

### Imported plans

- CSV import
- Active plan toggling
- In-app editing of plan metadata, day content, and session scheduling

### Data and reliability

- SQLite-backed local persistence through shared core queries
- Firebase sync integration
- Backup/export surfaces
- TypeScript across app and shared logic

## Tracker System Guide

The tracker system is now its own product layer inside FlowState rather than a handful of one-off module screens. One typed tracker engine drives creation, validation, storage, quick logging, summary cards, detail pages, and comparison analytics.

If you only remember one idea, remember this:

- `Today` is the canonical daily logging surface.
- `Library` is the canonical place to create, organize, edit, archive, and review trackers.
- `/trackers/[id]` is the canonical detail and stats surface for a single tracker.

### Mental model

- A `tracker` is a reusable object with a fixed kind, a label, optional emoji, configuration, folder placement, pin rules, and attached schedules and reminders.
- A `tracker entry` is the saved value for a tracker on a specific date.
- A `folder` organizes trackers, but does not decide whether they appear on Today.
- `pin rules` decide visibility on supported surfaces such as `today`, `session`, and `widget`.
- A `quick action` is a one-tap action on a pinned tracker, such as toggle, increment, decrement, or setting a fixed value.
- `derived trackers` calculate their value from dates, source trackers, or formulas instead of storing direct user input.
- The tracker `kind` is fixed after creation. You can edit the label, emoji, folder, rules, reminders, and config later, but changing kind means creating a new tracker.

### What changed from the old module model

- Trackers are now typed and validated through one shared registry instead of being spread across disconnected module-specific flows.
- Folder placement and visibility are separate concerns: folders organize, while pin rules control where a tracker shows up.
- Reminders are no longer a standalone tracker type. Any tracker can have reminders attached.
- Groups are no longer their own tracker type. Folder hierarchy handles organization.
- Stats are no longer a separate disconnected concept. Every tracker detail screen can show summary cards, history, and overlay charts when that kind supports comparison.
- The system now supports aggregate or meta-trackers, so you can calculate one score from several other trackers.

### Where you use trackers

- `Today`: log pinned trackers fast while planning and executing the day.
- `Library`: browse folders, search trackers, create trackers, move through nested folders, and restore archived trackers.
- `Tracker detail`: review the current state, quick log, inspect schedules and reminders, compare against another tracker, and scan recent history.
- `Tracker editor`: create a new tracker or refine an existing one.

### Core building blocks

- Surfaces: `today`, `session`, `widget`
- Sizes: `compact`, `wide`, `full`
- Entry modes:
  - `boolean`: yes or no style logging
  - `number`: numeric values, counters, ratings, durations
  - `text`: notes and prompt responses
  - `media`: photo logging
  - `none`: derived trackers that compute their own state

### Creating a tracker

1. Open `Library`.
2. Tap `New tracker`.
3. Give the tracker a clear name and optional emoji.
4. Choose the tracker kind.
5. Fill in the kind-specific configuration.
6. Choose a folder or leave it unfiled.
7. Turn on any pin rules you want for `today`, `session`, or `widget`.
8. Add schedules and reminders if needed.
9. Save the tracker. You land on the tracker detail page after creation.

### Configuring the basics well

- Use the label for the real question you want answered, not just a category name. `Sleep quality` is better than `Sleep`.
- Use emoji sparingly to make the Today surface easier to scan, especially for compact cards.
- Prefer one tracker per signal. If you are tracking both `Water intake` and `Caffeine intake`, give them separate trackers instead of one overloaded note tracker.
- Pick a folder for organization, but pin only the trackers you want visible day to day.
- Only enable quick actions for high-frequency flows where a one-tap action is genuinely better than opening the full quick log.

### Pinning and visibility

Pin rules control where a tracker appears. The same tracker can be visible in multiple places without duplication.

- `Today` is the main daily use case and the most important surface right now.
- `Session` and `Widget` use the same pin-rule model so trackers can be reused consistently in more focused surfaces.
- Size controls the visual weight of the card:
  - `compact` works well for habits, counters, and simple ratings
  - `wide` works well for richer summaries, prompts, metrics, and derived trackers
  - `full` is available for cases where a surface wants maximum emphasis

### Quick actions

Quick actions let a pinned tracker bypass a richer editor and do one useful thing immediately.

- Supported action types are `toggle`, `increment`, `decrement`, `set_number`, `set_text`, and `set_boolean`.
- Good quick-action use cases:
  - habit: `toggle`
  - counter: `increment` by `1`
  - metric in cumulative mode: `increment` by a fixed amount
  - rating: `set_number` if you use a consistent default
- Add a label if the action should read like a direct command such as `Log coffee`, `Mark done`, or `Add 250 ml`.
- If a tracker is not high-frequency, leave quick action off and use the normal quick-log UI instead.

### Schedules and reminders

Schedules and reminders are attached to the tracker itself.

- Schedules store recurring day-of-week and optional time-of-day rules.
- Reminders store day-of-week, time, message, and enabled state.
- The detail screen shows attached schedules and reminders together with the tracker.
- Reminder timing also feeds the summary data, so the detail surface can show the next reminder state.

### Daily use on Today

Today is where tracker logging is supposed to feel effortless. Pinned trackers appear as cards with summary state and, when supported, an inline quick log.

- Each card can show:
  - tracker kind
  - label and emoji
  - current display value
  - last logged date
  - streak badge when relevant
  - `Overlay ready` when comparison analytics are supported
- Tap the chevron on a tracker card to open the full detail page.
- Use quick actions when the tile exposes a one-tap action.

### Quick logging behavior by tracker kind

- `habit`
  - Quick log presents `Done` and `Reset`.
  - Best for daily yes or no behaviors such as meditation, vitamins, stretching, or inbox zero.
- `rating`
  - Quick log presents the scale inline, usually 5 or 10 points.
  - Best for sleep quality, mood, energy, focus, soreness, or satisfaction.
- `metric`
  - Quick log supports direct numeric input, plus and minus stepping, presets, and save.
  - In `set` mode, the saved number becomes the value for that date.
  - In `cumulative` mode, presets and increments add to the current total for that date.
- `counter`
  - Quick log supports step-based plus and minus logging and optional presets.
  - Best for coffee cups, cigarettes, pomodoros, pages read, or medication counts.
- `note`
  - Quick log is a text area plus save.
  - Best for short journaling, symptom logs, gratitude, blockers, or freeform reflections.
- `prompt`
  - Quick log looks like a note tracker but anchors the entry to a specific prompt.
  - Best for daily reflection questions, quotes with response space, or end-of-day check-ins.
- `photo`
  - Quick log can open the camera or photo library and attach images to the day.
  - Use this for progress photos, whiteboard snapshots, meal photos, or healing and recovery tracking.
- `derived kinds`
  - `countdown`, `countup`, `progress`, `streak`, `session`, and `aggregate` calculate their own state.
  - These normally show summary information and send you to detail rather than collecting direct raw input.

### Tracker kinds in detail

- `countdown`
  - Tracks time remaining until a target date.
  - Config includes target date, optional start date, display mode, alert days, progress-bar support, milestones, and a finished label.
  - Good for exams, deadlines, races, travel, launches, and taper windows.

- `countup`
  - Tracks elapsed time since a start date or event.
  - Config includes origin date, mode, display mode, and milestones.
  - Good for sobriety, consistency streak framing, recovery timelines, or time since a reset event.

- `habit`
  - Boolean completion tracker with cadence settings.
  - Config includes cadence, optional custom days, skip support, confirmation on tap, and streak enablement.
  - Good for habits that answer `Did I do this?`

- `rating`
  - Fixed-scale tracker for subjective numeric signals.
  - Config includes 5-point or 10-point scales, style, and optional labels.
  - Good when relative quality matters more than raw measurements.

- `metric`
  - Numeric measurement tracker with units and targets.
  - Config includes unit, target, min or max bounds, step size, mode, presets, and optional PR behavior.
  - Good for steps, weight, heart rate, study minutes, water, macros, sleep duration, and lifts.

- `counter`
  - High-frequency accumulation tracker optimized for repeated additions.
  - Config includes step, target, presets, and whether negative values are allowed.
  - Good for repeated events where the count itself matters more than a unit-rich metric.

- `note`
  - Freeform text tracker with optional prompt and template.
  - Config includes prompt, template, and max length.
  - Good for symptom notes, wins, debrief fragments, gratitude, or general narrative logging.

- `photo`
  - Media tracker for one or more photos per day.
  - Config includes prompt, maximum photos per day, caption support, and compare-mode intent.
  - Good for physique progress, injury recovery, room setups, plant growth, meal logs, or analog study notes.

- `progress`
  - Derived progress tracker.
  - `date` mode calculates progress between a start and end date.
  - `metric` mode derives progress from another tracker plus start and target values.
  - Good for projects, cuts, reading goals, exam prep, or long arcs with a finish line.

- `streak`
  - Derived streak tracker sourced from another tracker.
  - Config includes source tracker and grace hours.
  - Use this when you want a dedicated streak tile without overloading the source tracker card itself.

- `session`
  - Derived session tile that represents timer-driven or routine-launching behavior.
  - Config includes variant, optional routine, default duration, auto-start intent, and preview behavior.
  - Good for deep work blocks, workout launches, mandatory study sessions, or focus routines.

- `prompt`
  - Prompt card that can capture a response.
  - Config includes prompt, helper text, response mode, and rotation mode.
  - Good for daily prompts, quotes, coaching cues, and reflection scaffolds.

- `aggregate`
  - Derived meta-tracker calculated from weighted inputs.
  - Config includes weighted inputs, precision, max value, and optional low and high labels.
  - Best for scorecards such as `Wellness score`, `Readiness`, or `Daily quality score`.

### Aggregate trackers and scorecards

Aggregate trackers are the system's meta-tracker layer. They do not store raw entries. Instead, they calculate a score from other trackers.

- Current input format in the editor is one source per line:

```text
tracker-id-1:0.4
tracker-id-2:0.3
tracker-id-3:0.3
```

- Each line is `trackerId:weight`.
- Create the source trackers first.
- Use aggregate when you want one card to summarize several signals, such as sleep, steps, meditation, hydration, or readiness.
- If the aggregate tracker does not have enough source data yet, the detail screen will show that clearly instead of inventing a value.

Example idea:

- `Sleep quality` as a rating tracker
- `Meditation` as a habit tracker
- `Steps` as a metric tracker
- `Wellness score` as an aggregate tracker that blends the other three

### Library workflow

The library is the tracker control room.

- Search filters both folders and trackers.
- Folders can be nested.
- You can create a folder from the current library level.
- Unfiled trackers live at the root when they are not assigned to a folder.
- Archived trackers are shown in a dedicated section at the root so they can be restored without data loss.
- Opening a tracker from the library takes you straight to the detail page.

### Tracker detail workflow

The detail page is designed to answer two questions fast:

- What is the state of this tracker right now?
- What has this tracker been doing over time?

The detail screen includes:

- the tracker hero with kind, label, current display, and edit button
- inline quick log when the kind supports it
- archive or restore control
- link back to the library
- attached schedules
- attached reminders
- summary stat cards for current, last logged, best, and reminder status
- range switching for `30d`, `90d`, and `365d`
- overlay comparison with another tracker on the same time axis
- recent history, including thumbnails for photo trackers

### Overlay comparison mode

Overlay mode lets you compare one tracker against another on the same chart.

- Choose a time range.
- Leave the chart on `Single` to view the current tracker alone.
- Pick another tracker to overlay it.
- The chart will map both trackers onto the same timeline so you can look for relationships.

Good examples:

- `Caffeine intake` vs `Sleep quality`
- `Study minutes` vs `Energy`
- `Water intake` vs `Headache severity`
- `Weight` vs `Steps`

### Suggested tracker setups

- Sleep dashboard
  - `Sleep quality` as rating
  - `Sleep duration` as metric
  - `Caffeine` as counter
  - `Wellness score` as aggregate

- Deep work system
  - `Deep work minutes` as metric in cumulative mode
  - `Deep work session` as session tracker
  - `Focus quality` as rating
  - `Daily reflection` as prompt

- Health and recovery
  - `Medication` as habit
  - `Pain level` as rating
  - `Range of motion` as metric
  - `Recovery photo` as photo
  - `Recovery streak` as streak

- Fitness cut or bulk
  - `Weight` as metric
  - `Calories` as metric
  - `Gym session` as session
  - `Progress photo` as photo
  - `Plan progress` as progress

### Practical guidelines

- Use `habit` when the answer is yes or no.
- Use `rating` when the number is subjective.
- Use `metric` when the unit matters.
- Use `counter` when speed matters more than units.
- Use `note` when the context matters more than a number.
- Use `photo` when visual evidence is the signal.
- Use `progress`, `streak`, `countdown`, `countup`, and `aggregate` when you want a derived summary rather than more raw input.

### Data model notes for developers

- Trackers are stored separately from tracker entries, schedules, reminders, and layouts.
- Tracker entries persist both JSON and derived scalar columns, which keeps analytics from depending on string parsing.
- Comparison charts work because tracker series are normalized through the shared tracker registry and summary logic.
- Legacy module routes can still exist during migration, but the tracker model is the intended long-term path.

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
