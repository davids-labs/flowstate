# FlowState

FlowState is a mobile-first planner OS for running real life, not just storing tasks.

It combines:

- daily planning
- task capture and triage
- reusable session templates
- live focus timers
- trackers and quick logging
- reminders and automations
- Android home-screen widgets
- imports, backups, and legacy analytics

The repo currently contains a mobile app, a desktop app, and a shared core package. The mobile app is the main product surface and the center of this README.

## What FlowState Is For

FlowState works best when you want one system for:

- planning the shape of your day
- turning routines into repeatable timed sessions
- tracking habits, metrics, notes, streaks, countdowns, and progress
- separating work into pillars like `general`, `gym`, `academic`, and `life`
- importing plans from CSV and then editing them in-app
- reviewing how your weeks are actually going instead of guessing

Recommended use cases:

- Students who want one app for classes, study sessions, deadlines, grade tracking, and routines
- Lifters or athletes who want planned sessions, plate math, progression tracking, and reminders
- People managing personal systems who need tasks, habits, notes, countdowns, and structured day plans together
- Hybrid users who want focus timers, tracker logging, and a local-first planner that can still sync in the background

## Product Philosophy

FlowState treats planning as an operating system:

- `Today` is the cockpit
- `Plan` is where days get shaped
- `Inbox` is where loose ends get triaged
- `Track` is where logging lives
- sessions are first-class, not hidden behind a timer widget
- reminders should mirror what the app itself thinks matters
- widgets and analytics should support the plan, not compete with it

## Core Concepts

### Pillars

Pillars are high-level life buckets used for structure, color, and analytics:

- `general`
- `gym`
- `academic`
- `life`

### Day Plans

A day plan stores:

- a date
- a day title
- must-do priorities
- must-do completion state
- linked sessions
- linked tracker/module context
- notes and imported-plan context when relevant

### Tasks

Tasks support:

- title
- pillar
- category
- due date
- due time
- priority
- notes
- recurrence
- completion state

### Session Templates

Session templates define reusable focus flows. A template can include:

- multiple blocks
- block durations
- block names
- per-block todos
- per-block instructions
- block sets and variable block sets
- advanced modes such as timed, goal-based, and count-up

### Sessions

A session is a scheduled or launched instance of a template. Sessions carry:

- routine/template identity
- scheduled time
- status
- started and ended timestamps
- pause time
- current block state
- notes
- session events

### Trackers

Trackers are FlowState's flexible logging objects. They can be pinned to different surfaces and optionally support schedules, reminders, quick actions, and analytics.

### CSV Plans

CSV plans let you:

- import external plans
- preview validation before importing
- activate one plan at a time
- edit imported structure after the fact
- rename, deactivate, or delete imported plans

### Reminder Records

Reminder records are the shared reminder layer behind:

- session prompts
- tracker prompts
- streak alerts
- automation nudges
- snoozed reminders

### Widgets

Widgets are Android-first companion surfaces fed by snapshot data from the app.

### Local-First Data

FlowState is built around local persistence first:

- SQLite for app data
- AsyncStorage for app preferences and lightweight state
- optional background sync plumbing via Firebase-backed auth/sync helpers

## Main App Map

| Surface | Role | Best use |
| --- | --- | --- |
| `Today` | Daily cockpit | Run the current day |
| `Plan` | Agenda and scheduling | Shape today or upcoming days |
| `Inbox` | Triage queue | Clear overdue tasks and reminders |
| `Track` | Logging home | Capture habits, metrics, notes, and tracker updates |
| `Settings` | Personalization and setup | Configure automations, widgets, templates, plans, and backups |

## How To Use FlowState

### Recommended Setup Order

1. Open `Settings`
2. Choose a theme mode and preset
3. Set pillar colours if you care about visual separation
4. Turn on the session experience preferences you want, especially `auto-start` and `keep awake`
5. Build a few session templates in `Session templates`
6. Create a first set of trackers in `Track`
7. Configure reminders and automations
8. Configure widgets if you use Android home-screen widgets
9. Import a CSV plan if you are moving in an existing schedule

### Recommended Daily Flow

1. Start in `Today`
2. Review the morning brief, top priorities, and Now / Next / Later lanes
3. Launch or create sessions from `Plan` or `Today`
4. Use the live session dock to stay oriented while moving around the app
5. Triages loose tasks and prompts from `Inbox`
6. Log habits, metrics, or notes in `Track`
7. End with the evening review automation or a manual check in `Today`, `Inbox`, or `Insights`

### Recommended Weekly Flow

1. Review the upcoming dates in `Plan`
2. Check imported plans and activate the one you want
3. Review tracker and legacy stats in `Insights`
4. Open `Week View` for a compact weekly narrative and compliance read
5. Export a backup before any large data cleanup or import

## Detailed Feature Guide

### Today

`Today` is the main cockpit and includes:

- a date-aware hero
- a morning brief
- an inline `LiveSessionDock`
- top priorities / must-dos
- Now / Next / Later agenda lanes
- quick task capture for new priorities
- quick tracker logging cards
- shortcuts into `Inbox`, `Plan`, sessions, and tracker detail

What Today is good for:

- deciding what matters right now
- seeing the active session without losing the rest of the day
- checking quick status across priorities and trackers
- staying in the app's main "operating mode" instead of bouncing between tabs

### Plan

`Plan` is the calendar-lite agenda surface. It includes:

- date chips for a movable planning window
- an active-plan-aware date window
- per-day agenda loading
- task creation and editing
- session creation and editing
- day bundle loading that merges tasks, sessions, and trackers
- planner agenda views for selected dates

Use Plan when you want to:

- move off today and shape another day
- add or edit sessions on a specific date
- add tasks tied to a real day
- review workload density across the next week or two

### Inbox

`Inbox` is the triage surface. It mixes tasks and reminder-driven prompts into one queue.

Current inbox sections include:

- Overdue Tasks
- Inbox Tasks
- Upcoming Sessions
- Tracker Prompts
- Streak Alerts
- Reminder Queue
- Snoozed

Inbox actions include:

- open or edit a task
- open the linked session or tracker
- mark items done / clear them
- snooze real reminder records

Use Inbox when you want to:

- catch overdue work fast
- clear reminder noise in one place
- handle prompts without hunting through the app

### Track

`Track` is the tracker home. It includes:

- folder and sub-folder support
- tracker search
- tracker collections
- archived tracker visibility
- tracker cards with current summary
- entry into tracker detail
- lightweight folder creation

Track is where you should live for:

- quick daily logging
- organizing trackers into collections
- browsing archived trackers
- drilling into tracker detail and stats

### Tracker System

FlowState currently supports these tracker kinds:

- `countdown`
- `countup`
- `habit`
- `rating`
- `metric`
- `counter`
- `note`
- `photo`
- `progress`
- `streak`
- `session`
- `prompt`
- `aggregate`

Tracker features supported by the system include:

- schedules
- reminders
- quick actions
- pin rules for `today`, `session`, and `widget` surfaces
- collection / folder placement
- summaries and stats
- archived state
- source tracker relationships for derived trackers

Examples of how to use tracker kinds:

- `habit` for supplements, journaling, stretching, or study check-ins
- `metric` for bodyweight, sleep hours, pages read, or calories
- `counter` for reps, water cups, calls made, or sets completed
- `rating` for mood, energy, pain, focus, or sleep quality
- `note` for daily notes, reflection, or symptom logs
- `photo` for physique checks, progress photos, whiteboards, or meal logging
- `progress` for moving from a start state to a target state
- `streak` for derived streak tracking
- `session` for session-linked tracking workflows
- `aggregate` for weighted rollups across multiple trackers

### Tracker Detail

Tracker detail includes:

- quick log entry
- current summary
- schedules list
- reminders list
- archive / restore
- entry into tracker editing
- tracker-specific analytics

### Tracker Editor

The tracker editor supports:

- tracker kind selection
- label and emoji
- folder / collection assignment
- kind-specific config
- pin rules per surface
- quick action definitions
- schedules
- reminders
- source tracker mapping for derived trackers
- routine linkage when using session-type trackers

### Session Templates

The session template library lets you:

- create new templates
- inspect total duration
- inspect block count
- edit existing templates
- delete templates

Template editing supports:

- block editing
- descriptions
- block sets
- per-block instructions
- per-block todos
- advanced routine-launcher-compatible structures

### Planner Session Builder

The modern session builder sheet in the planner supports:

- choosing a reusable session template
- previewing block count and sample blocks
- assigning a scheduled time
- adding new sessions to a day
- editing an existing planned session
- quick time chips including `Now`

### Session Timer

The main session timer screen now includes:

- auto-start if enabled in settings
- full timer ring
- block progress
- pause / resume
- skip block
- complete session
- `Complete & Next`
- ad-hoc `Break 5m`
- break countdown
- break reminder notification
- quick resume from break
- session notes
- block todo checklists
- sibling session navigation
- state persistence
- keep-awake support
- haptic support
- debrief handoff after completion

Important session behaviors:

- `Complete & Next` is the correct way to move to the next session while keeping the current session's stats
- the ad-hoc break pauses context without forcing you to redesign the schedule
- the live dock replaces multiple older floating timer surfaces

### Live Session Dock

The `LiveSessionDock` is:

- inline on `Today`
- floating elsewhere in the app
- hidden on the dedicated session screen
- aware of active block, timer state, and next block

It supports:

- open session
- pause
- resume
- skip
- end
- status preview

### Session Debrief

After a session you can land on a debrief screen for:

- post-session summary
- review context
- next-step transition

### Legacy Routine Launcher

The immersive routine launcher is still in the app for advanced or legacy flows. It supports:

- full-screen routine running
- block condition locks
- count-up and goal-based blocks
- variable block sets
- block todo checklists
- per-block instructions
- drawer-based interaction

### Count-Up Session Flow

There is also a specialist count-up session screen for routines that run as independent blocks with accumulated elapsed time instead of a standard timer-engine flow.

### Notifications And Automations

The new reminder settings screen supports:

- master notification toggle
- morning brief automation
- morning brief time
- evening review automation
- evening review time
- session reminder lead time
- tracker reminder control
- badge count control

Reminder philosophy:

- notifications should mirror inbox items
- scheduled reminders should correspond to in-app reminder records
- session reminders should move with session edits
- snoozing should keep state visible instead of silently disappearing

### Widgets

Widget support is currently Android-first.

Widget surfaces:

- `FlowStateDay` -> Focus Widget
- `FlowStateQuickLog` -> Quick Log Widget
- `FlowStateWeeklyStats` -> Weekly Pulse Widget
- `FlowStateGoalProgress` -> Goals Widget

Widget setup supports:

- install instructions
- pinned tracker selection for Quick Log
- pinned tracker selection for Goals
- widget snapshot refresh
- widget compatibility notes

### Imports, CSV Plans, And Imported Plan Editing

FlowState supports CSV plan import through:

- file picking
- CSV parsing
- validation
- preview before import
- import success summary

Expected CSV ideas include:

- day dates
- day titles
- must-do lists
- session template references
- session times
- module / tracker targets
- quiet day flags

Imported plan management supports:

- viewing imported plans
- activation / deactivation
- rename
- delete
- stats and conflict checks

Imported plan editing supports:

- plan naming
- day-level editing
- date editing
- title editing
- top-priority editing
- session editing
- session time editing
- reassigning imported sessions to actual templates

### Insights And Review

The unified `Insights` entry point keeps analytics reachable without making them the main navigation model.

From Insights you can open:

- planner insights
- legacy gym stats
- legacy academic stats
- legacy life stats

Additional review surfaces include:

- `Week View` for weekly aggregate stats, narratives, trends, and daily compliance
- tracker detail analytics
- widget summaries

### Backup And Restore

FlowState can export and import a full JSON backup.

Backup includes tables for:

- collections
- routines
- routine blocks
- plans
- day plans
- module specs
- module values
- sessions
- event log
- homescreen layout
- module goals
- module schedules
- module reminders
- tasks
- task tags
- tagged time logs
- session tags
- session block todos
- session block instructions
- routine block sets
- courses
- course components
- csv plans

Backups also include referenced photo URIs.

Import warning:

- restore is destructive
- importing a backup replaces existing app data

### Utilities And Specialty Tools

The app also ships with smaller utility surfaces:

- `Plate Calculator` for gym plate loading and warm-up planning
- `Tag Timer` for tag-based count-up focus logging
- `Gallery` for photo-log browsing
- `Layout Editor` for legacy homescreen/module placement editing

### Personalization And Settings

Settings currently supports:

- theme mode: system, light, dark
- visual presets: default, midnight, warm, forest, ocean, mono
- pillar colour customization
- haptic feedback toggle
- keep-screen-awake toggle
- auto-start sessions toggle
- tab label visibility
- reminders and automations entry
- widget setup entry
- session templates entry
- Track entry
- imported plans entry
- CSV import entry
- insights entry
- backup and restore entry

### Sync And Data Behavior

FlowState is local-first, but the app also includes sync plumbing:

- anonymous Firebase-backed sign-in bootstrap
- queue persistence in AsyncStorage
- background push helpers for module values, day plans, timer state, and sessions
- initial pull and remote-apply hooks

The app should remain useful even if cloud sync is unavailable.

## Complete Mobile Screen Inventory

This section maps every current mobile app surface in `apps/mobile/app`.

### Primary Surfaces

| Route | Purpose | Status |
| --- | --- | --- |
| `/(tabs)/index` | Today cockpit | primary |
| `/(tabs)/plan` | Day planning and agenda | primary |
| `/(tabs)/inbox` | Unified triage queue | primary |
| `/(tabs)/track` | Tracker home and logging | primary |
| `/settings` | Main settings hub | primary |
| `/session/[id]` | Main session timer | primary |
| `/session/debrief` | Post-session summary | supporting |

### Setup And Editing

| Route | Purpose | Status |
| --- | --- | --- |
| `/routines/index` | Session template library | active |
| `/routines/create` | Create session template | active |
| `/routines/[id]` | Edit session template | active |
| `/trackers/[id]` | Tracker detail | active |
| `/trackers/edit` | Tracker editor | active |
| `/settings/notifications` | Reminder engine setup | active |
| `/settings/widgets` | Widget setup | active |
| `/settings/csv-plans` | Imported plan manager | active |
| `/settings/pillar-colours` | Pillar accent editing | active |
| `/import/pick` | Pick CSV import file | active |
| `/import/preview` | Review import before commit | active |
| `/import/success` | Import success summary | active |
| `/imported-plans/[id]` | Edit imported plan structure | active |
| `/backup/index` | Export and restore local data | active |

### Analytics, Review, And Supporting Views

| Route | Purpose | Status |
| --- | --- | --- |
| `/insights/index` | Unified analytics hub | active |
| `/statistics/index` | Insights alias | redirect / compatibility |
| `/stats/gym/index` | Legacy gym analytics | legacy but reachable |
| `/stats/academic/index` | Legacy academic analytics | legacy but reachable |
| `/stats/academic/grades` | Legacy grade analytics | legacy but reachable |
| `/stats/life/index` | Legacy life analytics | legacy but reachable |
| `/week/[weekId]` | Weekly narrative and aggregate review | specialist |
| `/gallery/index` | Photo log gallery | specialist |

### Tools And Specialist Flows

| Route | Purpose | Status |
| --- | --- | --- |
| `/tools/plate-calculator` | Gym load calculator | utility |
| `/tools/tag-timer` | Tag-based count-up work timer | utility |
| `/routine-launcher/[id]` | Legacy immersive routine runner | advanced legacy |
| `/countup-session/[id]` | Count-up routine execution | advanced legacy |
| `/layout-editor` | Legacy homescreen/module layout editing | legacy specialist |

### Legacy Aliases And Redirects

| Route | Purpose | Status |
| --- | --- | --- |
| `/(tabs)/today` | Old today alias | redirect |
| `/(tabs)/todos` | Old tasks tab | redirect to inbox |
| `/(tabs)/library` | Old library tab | redirect to track |
| `/(tabs)/profile` | Old profile tab | redirect to settings |
| `/(tabs)/progress` | Old progress tab | redirect to insights |
| `/(tabs)/gym` | Old gym hub | redirect |
| `/(tabs)/school` | Old school hub | redirect |
| `/(tabs)/life` | Old life hub | redirect |
| `/more/index` | Old settings / more hub | redirect to settings |
| `/day/[date]` | Old day route | redirect to plan |
| `/modules/index` | Old tracker index | redirect to track |
| `/modules/[id]` | Legacy tracker detail route | compatibility |
| `/modules/create` | Legacy tracker create route | compatibility |
| `/modules/edit` | Legacy tracker edit route | compatibility |
| `/modules/schedules` | Legacy schedule route | compatibility |
| `/modules/reminders` | Legacy reminder route | compatibility |
| `/trackers/index` | Old tracker index route | redirect to track |

## Repo Structure

| Path | Purpose |
| --- | --- |
| [apps/mobile](C:/dev/flowstate/flowstate/apps/mobile) | Main Expo / React Native app |
| [apps/desktop](C:/dev/flowstate/flowstate/apps/desktop) | Desktop app |
| [packages/core](C:/dev/flowstate/flowstate/packages/core) | Shared data, DB, sync, tracker, and planner logic |

## Local Development

### Mobile Development

From [apps/mobile](C:/dev/flowstate/flowstate/apps/mobile):

```bash
npm start
npm run android
npm run ios
npm run web
```

Useful checks:

```bash
node_modules\.bin\tsc.cmd --noEmit -p apps\mobile\tsconfig.json
```

### Local Android Release Build

FlowState includes a local release script:

- [apps/mobile/build-android.ps1](C:/dev/flowstate/flowstate/apps/mobile/build-android.ps1)

It expects:

- Java 17
- Android SDK
- NDK `27.1.12297006`
- `apps/mobile/android/local.properties` pointing at the SDK

Run:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File apps\mobile\build-android.ps1
```

Output:

- `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## Release And Update Notes

### GitHub Prereleases

This repo already uses GitHub prereleases for local Android APK drops, for example:

- `android-local-2026-04-01-0006`
- `android-local-2026-04-02-1117`
- `android-local-2026-04-02-1609`

### EAS Builds

The mobile app also has EAS configuration in:

- [apps/mobile/eas.json](C:/dev/flowstate/flowstate/apps/mobile/eas.json)

### How To Update Without Losing App Data

Android preserves app data when both of these stay the same:

1. package id
2. signing certificate

Current mobile package id:

- `com.davidslabs.flowstate`

That means:

- bumping `versionCode` and `versionName` is good and required
- changing signing identity is what breaks in-place upgrades
- local APK updates only work as updates when they are signed with the same key as the currently installed build

### Current Mobile Versioning

At the time of this README:

- app version: `1.1.0`
- Android `versionCode`: `2`
- iOS `buildNumber`: `2`

## Best Ways To Use FlowState

### Student Mode

- Use `academic` as a pillar
- import a term plan from CSV
- create session templates for revision, reading, problem sets, and labs
- use ratings, notes, and metrics for study quality
- review grades and academic insights weekly

### Gym Mode

- Use `gym` as a pillar
- build lifting templates as session templates
- use plate calculator before sessions
- track body metrics, lifts, photos, streaks, and progress targets
- use reminders for recurring training prompts

### Life Admin Mode

- Use `life` and `general`
- collect overdue tasks and reminders in `Inbox`
- track habits, notes, counters, and prompts in `Track`
- use countdowns for deadlines or trips
- use the evening review automation to reset the next day

### Deep Work Mode

- create session templates for common work blocks
- use auto-start and keep-awake
- run sessions from `Today`
- use the tag timer when you need freeform, non-template focus logging
- use `Complete & Next` when stacking multiple sessions in one day

## Known Product Shape

FlowState is intentionally mixed right now:

- the main product surface is the new mobile-first planner OS
- some older pillar hubs and module routes remain as compatibility paths
- some analytics and launcher surfaces are still legacy or specialist screens
- widgets are Android-first
- desktop exists in the repo but is not yet the center of product development

That is normal for the current state of the app. The README aims to document the whole shape honestly, including both the new primary flows and the older reachable surfaces.
