# Momentum — Local-First Daily Focus Planner

## 1. Product idea

Momentum is a small web app that helps a user choose a realistic plan for today, work through it in focused sessions, and reflect on what was completed. It combines a lightweight task backlog, a daily plan, a focus timer, and an end-of-day review.

The app is intentionally local-first: it requires no account or backend, and all data stays in the browser. This keeps the project bounded and makes it suitable for iterative development with a Ralph loop.

## 2. Goal

Build a polished, responsive single-user application that answers three questions:

1. What should I work on today?
2. What am I working on right now?
3. What did I accomplish?

## 3. Target user

A student, developer, or independent worker who wants more structure than a to-do list but less complexity than a full project-management tool.

## 4. Core user flow

1. The user captures tasks in an inbox.
2. The user adds up to five tasks to today's plan and orders them by priority.
3. The user starts a focus session for one planned task.
4. When the timer ends, the user marks the task complete or starts another session.
5. At the end of the day, the user reviews completed tasks and writes a short reflection.

## 5. Functional requirements

### 5.1 Task inbox

- Create a task with a required title.
- Optionally add notes, an estimated number of focus sessions (1–8), and a tag.
- Edit and delete tasks.
- Search tasks by title and filter them by tag.
- Move a task between `Inbox`, `Today`, and `Completed` states.
- Preserve the original creation date and completion date.

### 5.2 Today plan

- Show today's date and planned tasks.
- Limit the daily plan to five incomplete tasks.
- Reorder planned tasks with accessible move-up and move-down controls. Drag-and-drop may be added as an enhancement.
- Display each task's estimated and completed focus-session counts.
- Allow a task to be returned to the inbox.
- Show a simple progress summary, such as `2 of 4 tasks completed`.

### 5.3 Focus mode

- Start a focus session from a task in today's plan.
- Default session duration is 25 minutes.
- Allow session duration to be configured to 15, 25, 45, or 60 minutes in settings.
- Provide pause, resume, and cancel controls.
- Warn before cancelling a session that has progress.
- On completion, record the session against the selected task.
- Show a browser notification when a session finishes if permission has been granted.
- Recover an active timer accurately after a page refresh by storing its target end time.
- Only one focus session can be active at a time.

### 5.4 Daily review

- Show tasks completed today and the number of completed focus sessions.
- Allow the user to save a short reflection of up to 500 characters.
- Allow an incomplete task to be moved to tomorrow or returned to the inbox.
- Store one review per calendar date.
- Show past reviews in a read-only history view.

### 5.5 Settings and data

- Persist tasks, sessions, reviews, and settings in browser storage.
- Allow the user to export all durable user data as a versioned JSON file. Transient active-timer state is excluded.
- Allow the user to import a previously exported file after validation and confirmation.
- Allow the user to erase all data after an explicit confirmation.
- Support light, dark, and system themes.

## 6. User experience requirements

- The primary navigation contains `Today`, `Inbox`, `Focus`, and `Review`.
- The interface works from 360 px mobile screens through desktop widths.
- Empty states explain the next useful action.
- Destructive actions require confirmation or provide an undo action.
- All interactive controls are usable with a keyboard and have visible focus styles.
- Form fields have visible labels and validation messages.
- Status is not communicated by color alone.
- Respect the user's reduced-motion preference.

## 7. Suggested technical constraints

These are defaults and may be revised before implementation:

- React with TypeScript and Vite.
- CSS Modules or plain CSS with design tokens; no large UI component library.
- IndexedDB for application data, with a small typed repository layer.
- Vitest and Testing Library for unit and component tests.
- Playwright for critical end-to-end flows.
- No backend, authentication, analytics, or third-party API is required for version 1.

## 8. Data model

### Task

```ts
type TaskStatus = "inbox" | "today" | "completed";

interface Task {
  id: string;
  title: string;
  notes: string;
  tag: string | null;
  estimatedSessions: number;
  status: TaskStatus;
  plannedFor: string | null; // Local date: YYYY-MM-DD
  position: number;
  createdAt: string;         // ISO timestamp
  updatedAt: string;
  completedAt: string | null;
}
```

### Focus session

```ts
interface FocusSession {
  id: string;
  taskId: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string | null;
  outcome: "completed" | "cancelled";
}
```

### Daily review

```ts
interface DailyReview {
  date: string;              // Local date: YYYY-MM-DD
  reflection: string;
  createdAt: string;
  updatedAt: string;
}
```

### Active timer state

At most one active-timer record may exist. A running timer uses `targetEndAt`; a paused timer uses `remainingMsWhenPaused`. The inactive field must be `null`.

```ts
interface ActiveTimerState {
  sessionId: string;
  taskId: string;
  status: "running" | "paused";
  startedAt: string;
  targetEndAt: string | null;
  remainingMsWhenPaused: number | null;
  updatedAt: string;
}
```

## 9. Acceptance criteria for version 1

Version 1 is complete when:

- A first-time user can create a task, add it to today, complete a focus session, finish the task, and see it in the daily review.
- Refreshing or closing and reopening the app does not lose data.
- An active focus timer remains accurate after a refresh.
- The five-task daily limit is enforced in both the interface and data layer.
- Exported durable data can be erased and then restored through an atomic import without losing supported fields; active-timer state is neither exported nor restored.
- The core flow passes automated end-to-end tests at mobile and desktop viewport sizes.
- There are no known keyboard traps or critical accessibility violations in the core flow.
- The production build completes without TypeScript errors.

## 10. Ralph-loop implementation milestones

Each milestone should leave the app in a working, testable state.

1. **Foundation** — Create the app shell, routes, design tokens, responsive navigation, and test setup.
2. **Persistence** — Define the data model and implement the IndexedDB repository with tests.
3. **Inbox** — Implement task creation, editing, deletion, search, filtering, and empty states.
4. **Today** — Implement daily planning, the five-task limit, ordering, and progress summary.
5. **Focus** — Implement timer state, refresh recovery, session records, and notifications.
6. **Review** — Implement daily summaries, reflections, rollover actions, and review history.
7. **Data controls** — Implement theme settings, JSON export/import, validation, and data erasure.
8. **Hardening** — Add end-to-end tests, accessibility checks, responsive polish, and error states.

## 11. Out of scope for version 1

- User accounts or synchronization between devices.
- Shared tasks, teams, or social features.
- Calendar integrations.
- AI-generated task suggestions.
- Native mobile or desktop applications.
- Detailed productivity analytics or gamification.

## 12. Possible future ideas

- Installable PWA with offline caching.
- Recurring tasks.
- Optional short-break timer between focus sessions.
- Weekly review and trend charts.
- Calendar time-blocking.
- Encrypted cross-device synchronization.
