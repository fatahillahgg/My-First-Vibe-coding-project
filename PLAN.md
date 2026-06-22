# PLAN.md — Momentum implementation plan

This is the execution ledger for the Ralph loop. Work from top to bottom. Check an item only after its acceptance condition has been implemented and verified. When new work is discovered, place it in the appropriate phase rather than silently expanding the active task.

Status legend: `[ ]` pending, `[x]` complete, `[!]` blocked.

## Current state

- Requirements: version 1 complete; Phases 1–8 are implemented and verified.
- Application code: release-ready local-first planner with the complete focus/review flow, persistent settings, safe data controls, and hardened recovery states.
- Active phase: none — version 1 release gate passed.
- Next task: none required for version 1.
- Blockers: none known.

## Phase 1 — Foundation

- [x] **1.1 Scaffold the application**
  - Create a React + TypeScript + Vite project in the repository root.
  - Add strict TypeScript configuration and useful npm scripts.
  - Add `.gitignore` entries for dependencies, build output, coverage, and browser-test artifacts.
  - Acceptance: the untouched starter app installs, type-checks, and builds successfully.

- [x] **1.2 Configure automated quality checks**
  - Configure ESLint, Vitest, Testing Library, and the DOM test environment.
  - Add one smoke test and scripts for lint, type-check, and unit tests.
  - Acceptance: lint, type-check, unit test, and build commands all pass.

- [x] **1.3 Create the responsive application shell**
  - Add routes for Today, Inbox, Focus, Review, and Settings.
  - Add semantic desktop navigation and compact mobile navigation containing only Today, Inbox, Focus, and Review; expose Settings through a secondary action.
  - Add design tokens, global styles, light/dark/system theme foundations, and reduced-motion handling.
  - Acceptance: every route is keyboard reachable and usable at 360 px and desktop widths, and Settings is not rendered as a fifth primary navigation item.

## Phase 2 — Domain and persistence

- [x] **2.1 Define domain models and date utilities**
  - Add typed models for tasks, focus sessions, reviews, settings, and `ActiveTimerState`.
  - Define `ActiveTimerState` as the single optional active-timer record with `sessionId`, `taskId`, `status: "running" | "paused"`, `startedAt`, `targetEndAt: string | null`, `remainingMsWhenPaused: number | null`, and `updatedAt`.
  - Require a running timer to have `targetEndAt` and no paused remainder; require a paused timer to have `remainingMsWhenPaused` and no target end.
  - Add local-date and timestamp utilities with boundary tests.
  - Acceptance: domain types match the requirements; invalid timer-state combinations are rejected; date tests cover local-day behavior.

- [x] **2.2 Implement the IndexedDB repository**
  - Add a versioned database schema and typed repository interface.
  - Implement CRUD operations for tasks, sessions, reviews, settings, and the single optional active-timer record.
  - Keep an in-memory repository implementation for fast deterministic tests.
  - Run the same repository contract suite against the in-memory and IndexedDB adapters.
  - Acceptance: both adapters pass the contract suite, only one active-timer record can exist, and IndexedDB data remains available after closing and reopening the database.

- [x] **2.3 Add application data state and error handling**
  - Connect repositories to React through a small state/service layer.
  - Provide loading and recoverable error states.
  - Acceptance: UI code can read and mutate data without direct IndexedDB calls.

## Phase 3 — Inbox

- [x] **3.1 Create and display tasks**
  - Build the Inbox empty state, task list, and accessible creation form.
  - Validate required title and estimated sessions from 1–8.
  - Acceptance: creating a valid task persists it and validation errors are announced.

- [x] **3.2 Edit and delete tasks**
  - Support editing every user-editable task field.
  - Add confirmed deletion or a reliable undo flow.
  - Acceptance: edits survive refresh and deletion cannot occur accidentally.

- [x] **3.3 Search and filter the inbox**
  - Search titles and filter by tag, including a clear no-results state.
  - Acceptance: filters can be combined and cleared without modifying stored tasks.

## Phase 4 — Today planning

- [x] **4.1 Add tasks to today's plan**
  - Add Inbox actions for planning a task today.
  - Treat `plannedFor` as the planned date and enforce a maximum of five incomplete tasks independently for each local date in domain logic and UI.
  - Acceptance: a sixth incomplete task for the same `plannedFor` date is rejected with a clear explanation, while capacity on another date is unaffected.

- [x] **4.2 Build the Today view**
  - Display the local date, ordered tasks, progress, and session estimates for tasks whose `plannedFor` exactly matches the current local date.
  - Do not show future-dated or overdue tasks in the Today list.
  - Allow tasks to return to the Inbox.
  - Acceptance: state and progress remain correct after refresh, and changing the local-date boundary selects the correct planned tasks.

- [x] **4.3 Reorder today's tasks**
  - Add keyboard-accessible move-up and move-down controls.
  - Normalize and persist task positions.
  - Acceptance: ordering persists and boundary controls are correctly disabled.

## Phase 5 — Focus mode

- [x] **5.1 Implement timer domain logic**
  - Model idle, running, paused, completed, and cancelled states.
  - Persist the optional `ActiveTimerState` record: running uses `targetEndAt`; pausing freezes the calculated remainder in `remainingMsWhenPaused`; resuming creates a new target end from that remainder.
  - Calculate remaining time from timestamps so refresh and delayed ticks remain accurate.
  - Enforce one active session in both domain logic and the repository.
  - Acceptance: deterministic tests cover pause, resume, refresh, expiration, and clock drift.

- [x] **5.2 Build the Focus interface**
  - Start a session from a Today task and show remaining time.
  - Add pause, resume, and confirmed cancellation controls.
  - Support 15, 25, 45, and 60-minute settings.
  - Acceptance: the complete timer interaction works with keyboard and persists across refresh.

- [x] **5.3 Record completed sessions and notify**
  - Store completed/cancelled outcomes and update task session progress.
  - Add opt-in browser notification behavior with a graceful unsupported/denied state.
  - Acceptance: a completed session appears once against the correct task.

## Phase 6 — Completion and daily review

- [x] **6.1 Complete and reopen tasks**
  - Record completion timestamps and update Today progress.
  - When reopening, restore the task to Today only if its retained `plannedFor` is the current local date and that date has fewer than five incomplete tasks; otherwise move it to Inbox and clear `plannedFor`.
  - Acceptance: task status and timestamps remain internally consistent, reopening clears `completedAt`, and the five-task limit cannot be bypassed.

- [x] **6.2 Build today's review**
  - Show today's completed tasks and completed session count.
  - Save one reflection of at most 500 characters per local date.
  - Acceptance: summaries derive from persisted records and reflections survive refresh.

- [x] **6.3 Add rollover actions and review history**
  - Show incomplete tasks with a past `plannedFor` date as overdue in Review until the user explicitly acts on them; do not silently move or hide them.
  - Move an overdue task to tomorrow by setting `status` to `"today"` and `plannedFor` to the next local date, or return it to Inbox by setting `status` to `"inbox"` and clearing `plannedFor`.
  - Enforce tomorrow's independent five-task limit during rollover.
  - List past reviews in a read-only history view.
  - Acceptance: overdue tasks remain actionable across refresh, rollover preserves task history and never duplicates tasks, and a full tomorrow plan rejects additional rollover.

## Phase 7 — Settings and data controls

- [x] **7.1 Finish theme and timer settings**
  - Persist light, dark, or system theme and preferred session duration.
  - React to system-theme changes when system mode is selected.
  - Acceptance: settings apply on reload without an incorrect-theme flash where practical.

- [x] **7.2 Export versioned JSON data**
  - Export tasks, completed/cancelled focus sessions, reviews, and settings with a format version.
  - Exclude `ActiveTimerState` because it is transient operational state rather than backup data.
  - Acceptance: the downloaded file is valid JSON, represents current durable user data, and contains no active-timer record.

- [x] **7.3 Validate and import JSON data**
  - Validate file type, format version, field types, references, and supported values before mutation.
  - Show a summary and require confirmation before replacing data; warn that confirmation cancels and clears any active timer.
  - Replace all imported stores and clear `ActiveTimerState` in one IndexedDB read-write transaction.
  - Acceptance: validation or transaction failure leaves all existing data and the active timer untouched; a successful import atomically replaces durable data, clears the active timer, and preserves all supported fields in a valid round trip.

- [x] **7.4 Erase all application data**
  - Add explicit destructive confirmation and return the app to a clean first-run state.
  - Acceptance: all app stores are cleared while cancellation changes nothing.

## Phase 8 — Hardening and release readiness

- [x] **8.1 Add critical Playwright journeys**
  - Cover create → plan → focus → complete → review.
  - Run the journey at mobile and desktop viewport sizes.
  - Acceptance: critical end-to-end tests pass consistently from a clean state.

- [x] **8.2 Audit accessibility**
  - Verify keyboard navigation, focus management, form errors, names, contrast, and non-color state indicators.
  - Add automated accessibility checks for primary pages.
  - Acceptance: no known keyboard trap or critical automated accessibility violation remains.

- [x] **8.3 Polish resilience and responsive behavior**
  - Exercise empty, loading, storage-failure, invalid-data, and narrow-screen states.
  - Fix layout overflow and unclear recovery paths.
  - Acceptance: core features remain understandable from 360 px through desktop widths.

- [x] **8.4 Run the release gate**
  - Run lint, type-check, unit/component tests, end-to-end tests, and production build.
  - Review every version 1 acceptance criterion in `docs/REQUIREMENTS.md`.
  - Acceptance: all checks pass and each criterion has implementation/test evidence.

## Deferred ideas

Do not implement these during version 1 unless the requirements are changed:

- Installable PWA and offline caching.
- Recurring tasks and break timers.
- Weekly analytics and calendar time-blocking.
- Accounts, collaboration, or cross-device sync.

## Decisions and assumptions

- Package manager is initially assumed to be npm; revise this before scaffolding if the repository adopts another manager.
- A cancelled focus session is retained for history but does not increase completed-session progress.
- “Today” always means the user's current local calendar date.
- `plannedFor` determines the date bucket for the five-task limit; tasks with a past date remain overdue until explicitly rolled over or returned to Inbox.
- Reopening restores a task to Today only when it was planned for the current date and capacity remains; otherwise it returns to Inbox.
- Import replaces the current durable dataset only after successful full-file validation and confirmation, using one atomic IndexedDB transaction.
- `ActiveTimerState` is operational local state: it is persisted for refresh recovery but excluded from backup files and cleared by a successful confirmed import.
- Settings is a secondary destination, not a fifth primary navigation item.

## Work log

Append one entry per Ralph iteration. Keep entries factual and concise.

### 2026-06-20 — Planning setup

- Created the project operating rules in `AGENTS.md`.
- Converted `docs/REQUIREMENTS.md` into ordered, testable implementation tasks.
- Verification: documentation review only; application commands are unavailable until task 1.1.
- Next: 1.1 Scaffold the application.

### 2026-06-20 — Planning refinement

- Standardized references to `AGENTS.md` and clarified navigation, date buckets, overdue rollover, and reopen behavior.
- Defined persisted active-timer state, cross-adapter repository tests, atomic import, and backup exclusions.
- Verification: documentation consistency checks only; implementation remains at task 1.1.
- Next: 1.1 Scaffold the application.

### 2026-06-20 — Phase 1 foundation

- Completed 1.1: scaffolded React 19, TypeScript 6, Vite 8, npm scripts, lockfile, and generated-file ignores.
- Completed 1.2: configured ESLint, Vitest, Testing Library, Playwright, six component smoke tests, and two browser smoke projects, including an exact 360 px mobile viewport.
- Completed 1.3: added responsive routes for Today, Inbox, Focus, Review, and Settings; primary navigation contains only the four product destinations and Settings remains secondary.
- Added a token-based light/dark visual foundation, visible focus states, skip navigation, responsive desktop/mobile layouts, and reduced-motion handling.
- Significant dependencies: React Router for client routing; Testing Library/Vitest for component checks; Playwright for real-browser viewport verification.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (6 tests), `npm run test:e2e` (2 projects), and `npm run build`.
- Progress report: `docs/reportprogress.md`.
- Next: 2.1 Define domain models and date utilities.

### 2026-06-20 — Phase 2 domain and persistence

- Completed 2.1: added strict domain models, discriminated running/paused timer states, runtime entity validation, canonical ISO timestamp checks, and time-zone-safe local-date utilities.
- Completed 2.2: added a versioned native IndexedDB schema plus in-memory adapter behind one repository contract for tasks, sessions, reviews, settings, and the singleton active timer.
- Ran the same CRUD/defensive-copy contract against both adapters and verified every IndexedDB store survives close and reopen.
- Completed 2.3: added an application data provider that initializes IndexedDB before rendering, exposes repositories through a hook, and provides accessible loading plus recoverable error/retry states.
- Significant dependency: `fake-indexeddb` is development-only and provides deterministic browser-storage tests without touching developer data.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (36 tests), `npm run test:e2e` (2 projects), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 3.1 Create and display tasks.

### 2026-06-20 — Phase 3 Inbox

- Completed 3.1: replaced the placeholder with an accessible task form, empty/loading/error states, validated title and 1–8 session estimate, persisted task creation, and repository-backed task cards.
- Completed 3.2: added inline editing for title, notes, estimate, and tag while preserving identity/creation time; added deletion with a multi-step undo stack.
- Completed 3.3: added case-insensitive title search, tag filtering, combined filters, clear controls, and a no-results state that never mutates storage.
- Tightened persisted task validation so blank titles are rejected outside the UI as well.
- Added feature tests for validation, remount persistence, full-field editing, delete/undo, and combined filters; expanded Playwright to cover IndexedDB refresh persistence and the full Inbox flow at 360 px and desktop.
- No new runtime dependency was added for Phase 3.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (41 tests), `npm run test:e2e` (4 tests), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 4.1 Add tasks to today's plan.

### 2026-06-20 — Phase 4 Today planning

- Completed 4.1: added Inbox planning actions and a `TaskPlanningService` that enforces five incomplete tasks independently per `plannedFor` date; overlapping operations are serialized so concurrent clicks cannot bypass the limit.
- Completed 4.2: replaced the static Today placeholder with an exact-local-date plan, midnight date refresh, empty/loading/error states, completed-task progress, current-plan focus-session counts, and return-to-Inbox actions.
- Completed 4.3: added accessible move-up/down controls with disabled boundaries, atomic bulk repository writes, and normalized persisted positions.
- Expanded the repository contract with bulk task writes against both in-memory and IndexedDB adapters.
- Added service and component coverage for per-date capacity, concurrent additions, date switching, future/overdue exclusion, progress, session estimates, return transitions, and reorder persistence.
- No new dependency was added for Phase 4.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (55 tests), `npm run test:e2e` (6 tests), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 5.1 Implement timer domain logic.

### 2026-06-21 — Phase 5 Focus mode

- Completed 5.1: added deterministic idle/running/paused/completed/cancelled timer transitions, timestamp-derived remaining time, pause/resume persistence, expiry recovery, duration clamping for backward clock drift, and atomic singleton start/finish repository operations.
- Completed 5.2: replaced the Focus placeholder with a keyboard-operable timer, Today-task selection and launch links, 15/25/45/60-minute persisted duration choices, pause/resume, progress-aware cancellation confirmation, loading/error states, and refresh recovery.
- Completed 5.3: persisted in-progress sessions and atomically finalized completed/cancelled outcomes, counted completed sessions exactly once on Today, and added opt-in browser notifications with explicit unsupported, default, granted, and denied states.
- Fixed a React Strict Mode recovery race so an expired session's completed feedback is not immediately overwritten by a duplicate idle load.
- Added timer service, repository contract, component, and Playwright coverage for concurrency, pause/resume, remount/refresh, delayed expiration, cancellation, clock drift, settings, notification fallback, and exact session counting at mobile and desktop widths.
- No new dependency was added for Phase 5.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (64 tests), `npm run test:e2e` (8 tests), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 6.1 Complete and reopen tasks.

### 2026-06-21 — Phase 6 Completion and daily review

- Completed 6.1: added persisted completion/reopen transitions, completion timestamps, immediate Today progress updates, and runtime lifecycle validation for consistent `status`, `plannedFor`, and `completedAt` combinations.
- Reopening retains Today placement only for the current local date when fewer than five incomplete tasks remain; otherwise it clears the planned date and returns the task to Inbox without bypassing capacity.
- Completed 6.2: replaced the Review placeholder with local-date summaries for completed tasks and sessions plus a labeled 500-character reflection editor backed by one upserted review per date.
- Completed 6.3: kept past-dated incomplete tasks visible as overdue, added explicit move-to-tomorrow and return-to-Inbox actions, enforced tomorrow's independent capacity, and added newest-first read-only reflection history.
- Added service and component tests for lifecycle consistency, full-plan reopening, local-date summaries, reflection persistence/limits, overdue persistence, non-duplicating rollover, full-tomorrow rejection, and review history.
- Extended the mobile and desktop Playwright journey through task completion, Review visibility, reflection save, and refresh persistence.
- No new dependency was added for Phase 6.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (79 tests), `npm run test:e2e` (8 tests), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 7.1 Finish theme and timer settings.

### 2026-06-22 — Phase 7 Settings and data controls

- Completed 7.1: replaced the Settings placeholder with persistent light/dark/system theme controls and 15/25/45/60-minute defaults; system mode reacts to media-query changes and a local preference mirror applies the expected palette before React initializes.
- Completed 7.2: added Momentum backup format version 1 with a canonical export timestamp and durable tasks, finished focus sessions, reviews, and settings; active timers and unfinished sessions are excluded.
- Completed 7.3: added file type, JSON, format version, entity, duplicate-key, session-reference, supported-value, and daily-limit validation plus a pre-mutation summary and explicit replacement confirmation.
- Added atomic durable-data replacement to both repository adapters; IndexedDB clears and replaces every durable store plus the active timer in one read-write transaction, while validation failures preserve all current data and timer state.
- Completed 7.4: added explicit irreversible confirmation and an atomic erase-all operation that clears every store and restores first-run default settings.
- Closed a referential-integrity edge case by making task delete/undo atomically include related focus sessions and an associated active timer, preventing orphan session references in exported backups.
- Added service, repository-contract, theme, Settings component, and mobile/desktop browser coverage for persistence, system changes, export, round-trip import, invalid backups, cancellation, active-timer clearing, and erase defaults.
- No new dependency was added for Phase 7.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (95 tests), `npm run test:e2e` (10 tests), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: 8.1 Add critical Playwright journeys.

### 2026-06-22 — Phase 8 Hardening and release readiness

- Completed 8.1: promoted the clean-storage create → plan → focus → refresh/complete → complete task → review → persist reflection journey to the critical Playwright gate at 360 px mobile and desktop widths.
- Completed 8.2: added Axe WCAG A/AA scans for every primary destination and state-rich Focus, Review, and import-preview screens; added keyboard checks for skip navigation, focus visibility, and all four primary links.
- Fixed audit findings by increasing light-theme brand/accent contrast and preserving dark/destructive button contrast during hover.
- Completed 8.3: added cross-route overflow checks, long-content wrapping checks, reduced-motion verification, and an invalid-IndexedDB recovery journey that links directly to data controls and returns safely to first-run state.
- Added direct data-control recovery links to Inbox, Today, Focus, and Review load-error states.
- Completed 8.4: reviewed all eight version 1 acceptance criteria and linked each to automated evidence in `docs/reportprogress.md`.
- Significant dev-only dependency: `@axe-core/playwright` runs WCAG checks in Playwright and is excluded from the production bundle.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (95 tests), `npm run test:e2e` (28 tests across mobile and desktop), and `npm run build`.
- Progress report updated: `docs/reportprogress.md`.
- Next: version 1 has no remaining required plan item.

### 2026-06-22 — User documentation

- Added `README.md` as the version 1 user guide covering local setup, the complete daily workflow, timer recovery, reviews, settings, backup/restore, data erasure, privacy expectations, accessibility, and version 1 limitations.
- Confirmed all required plan items and version 1 acceptance criteria were complete before publishing the guide.
- Verification: documentation review against `docs/REQUIREMENTS.md`, authoritative npm commands, and the final release report.

### 2026-06-22 — Production container

- Iteration goal: package the completed Momentum static build as a production container; completion requires a successful image build, a healthy running container, SPA route fallback, and documented local commands.
- Added a multi-stage Node/nginx Docker build, a minimized build context, immutable caching for hashed assets, no-cache HTML delivery, security response headers, SPA route fallback, and a container health check.
- Documented Docker build, run, storage, and shutdown behavior in `README.md`.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test` (95 tests), `npm run build`, `docker build -t momentum:local .`, healthy container status, direct `/review` fallback, security headers, and immutable hashed-asset caching.

### 2026-06-22 — GitHub publication

- Iteration goal: publish the verified Momentum v1 source and production-container configuration to `fatahillahgg/My-First-Vibe-coding-project`; completion requires the remote `main` branch to resolve to the local release commit.
