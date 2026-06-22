# Momentum

Momentum is a local daily focus planner that helps you answer three simple questions:

1. What do I need to work on today?
2. What am I focusing on right now?
3. What have I completed?

Momentum does not require an account or a server. Tasks, focus sessions, reviews, and settings are stored locally in the browser on the device currently being used.

## Key features

- Inbox for logging, searching, filtering, editing, and deleting tasks.
- Daily plan containing a maximum of five unfinished tasks.
- Priority sorting with keyboard-friendly controls.
- Focus timer for 15, 25, 45, or 60 minutes with pause, resume, and cancel capabilities.
- Timer recovery that remains accurate even after refreshing the page.
- Optional browser notifications when a session is completed.
- Summary of tasks and sessions completed today.
- Daily reflection of up to 500 characters and a history of previous reviews.
- Overdue task handling: move them to tomorrow or return them to the Inbox.
- Light, dark, or system-default themes.
- Full data export, import, and deletion with confirmation prompts.

## Running Momentum

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`.
- npm.
- A modern browser with IndexedDB support.

### Installation

```sh
npm install
npm run dev
```

Open the address displayed by Vite in your terminal, usually `http://localhost:5173`.

To run a production build locally:

```sh
npm run build
npm run preview
```

### Running with Docker

Build the production image and run the container:

```sh
docker build -t momentum .
docker run --rm -p 8080:80 --name momentum momentum
```

Open `http://localhost:8080`. Data is still stored in the browser's IndexedDB, not inside the container, so restarting the container will not delete the workspace on the same browser.

To stop the container, press `Ctrl+C` in the terminal running it.

## How to use

### 1. Log tasks in the Inbox

Open the **Inbox**, then enter a task title. Notes, tags, and estimated focus sessions are optional. Tasks can be edited, searched by title, or filtered by tags.

Deleted tasks can be recovered using the **Undo** button as long as the undo notification is still available.

### 2. Plan your day

Select **Plan today** on a task in the Inbox. Momentum limits the plan to a maximum of five unfinished tasks to keep the day realistic.

On the **Today** page, use the arrow buttons to change the priority order. Tasks can also be returned to the Inbox.

### 3. Run focus sessions

Select **Focus** on a task in Today, set the session duration, and click **Start focus session**.

- **Pause** freezes the remaining time.
- **Resume** continues from that time.
- **Cancel session** prompts for confirmation if the session is already running.
- Refreshing or reopening the page does not reset the active timer.

Momentum only allows one active focus session. If browser notification permissions are granted, an alert will appear when the session finishes.

### 4. Complete tasks

Once the work is done, press **Complete** on the task on the Today page. Completed tasks can be reopened using **Reopen**.

If the Today plan is already full when a task is reopened, the task is returned to the Inbox so the five-task limit is not exceeded.

### 5. Close the day with Review

The **Review** page displays tasks and the number of focus sessions completed on today's date. You can save one reflection of up to 500 characters.

Tasks from previous days remain visible as overdue until you choose to:

- move them to tomorrow; or
- return them to the Inbox.

Older reflections are available as a read-only history.

## Settings and backup

Open **Settings** via the secondary button in the sidebar or mobile header.

### Theme and duration

Choose between **System**, **Light**, or **Dark** themes, as well as a default focus duration of 15, 25, 45, or 60 minutes. Settings persist after refreshing.

### Export data

Click **Export JSON backup** to download tasks, ended sessions, reviews, and settings in the Momentum Backup v1 format.

Active timers are not included in the backup because they are temporary states.

### Import data

Select a `.json` backup file. Momentum validates the entire file and displays a summary before asking for confirmation.

Importing will overwrite all existing data. If the import is confirmed, the active timer is canceled and cleared alongside the data replacement in a single transaction.

### Erase all data

Use **Erase all data** to delete tasks, sessions, reviews, settings, and the active timer. This action requires confirmation and cannot be undone.

## Privacy and data security

- All application data is stored locally using IndexedDB.
- Momentum has no accounts, backend, analytics, or cross-device synchronization.
- Data on one browser is not automatically available on other browsers or devices.
- Clearing site data, browser profiles, or browser storage may delete your Momentum workspace.
- Create JSON backups regularly if data needs to be retained or migrated.

## Accessibility and devices

Momentum is fully keyboard accessible, provides visible focus indicators, supports skip navigation, and respects `prefers-reduced-motion`. The UI has been verified across viewports ranging from 360px mobile to desktop.

## Project checks

```sh
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

The latest release gate passed with 95 unit/component tests and 28 Playwright checks on Chromium mobile and desktop.

## Version 1 limitations

Momentum v1 does not yet provide accounts, cross-device synchronization, collaboration, recurring tasks, calendar integrations, or native applications.

Product documentation and implementation status are available in the [requirements](docs/REQUIREMENTS.md), [implementation plan](PLAN.md), and [progress report](docs/reportprogress.md).
