# AGENTS.md — Momentum

## Project mission

Build **Momentum**, a polished local-first daily focus planner. The product requirements and acceptance criteria in `docs/REQUIREMENTS.md` are the source of truth.

The project is developed through a Ralph loop: each iteration takes one small, verifiable item from `PLAN.md`, implements it completely, validates it, records the result, and leaves the repository in a working state.

## Files to read before working

Read these files in order at the beginning of every iteration:

1. `AGENTS.md` — working rules.
2. `docs/REQUIREMENTS.md` — product scope and acceptance criteria.
3. `PLAN.md` — current priorities, completed work, and known issues.

Inspect the existing implementation and tests before changing code. Do not assume a task is missing merely because the plan says it is incomplete.

## Ralph-loop protocol

For every iteration:

1. Select the first unchecked task whose dependencies are complete.
2. Restate the task and its observable completion condition in the work log.
3. Inspect the smallest relevant part of the codebase.
4. Implement one coherent vertical slice. Keep unrelated refactors out of the iteration.
5. Add or update automated tests for behavior changed by the task.
6. Run the narrowest relevant checks, then the broader verification suite when practical.
7. Fix failures caused by the change. Do not hide failures by weakening or deleting tests.
8. Update `PLAN.md`: check completed items, add discoveries, and append a concise work-log entry.
9. End with a repository that builds and runs, or clearly document the exact blocker in `PLAN.md`.

Never mark a task complete when its acceptance criteria have not been verified.

## Priority rules

- Work from the top of `PLAN.md` unless an earlier item is blocked.
- Resolve broken builds and failing tests before starting new features.
- Prefer core user flow over optional polish.
- Treat items under “Out of scope” in `docs/REQUIREMENTS.md` as prohibited unless the requirements are explicitly revised.
- If requirements are ambiguous, choose the smallest behavior consistent with the product goal and record the assumption in `PLAN.md`.

## Technical direction

- Use React, TypeScript, and Vite.
- Use IndexedDB behind a typed repository interface. UI components must not access IndexedDB directly.
- Persist the single `ActiveTimerState` record through that repository. A running timer stores its target end timestamp; a paused timer stores its frozen remaining milliseconds.
- Keep domain logic independent from React where practical so it can be unit tested.
- Use local calendar dates (`YYYY-MM-DD`) for planning and reviews, and ISO timestamps for instants.
- Treat `plannedFor` as the source of truth for a planned task's date. The five-task limit applies independently to each local date, and the Today view only shows tasks whose `plannedFor` equals the current local date.
- Store enough timer state to reconstruct the correct remaining time after refresh; do not rely only on an in-memory interval counter.
- Enforce business rules, including the five-task daily limit and single active session, in the data/domain layer as well as the UI.
- Keep Today, Inbox, Focus, and Review as the only primary navigation destinations. Expose Settings through a secondary action.
- Prefer native browser and semantic HTML capabilities before adding dependencies.
- Keep dependencies minimal and explain any significant addition in the work log.

## Code quality

- Enable strict TypeScript; avoid `any` and unsafe type assertions.
- Keep components focused and name behavior clearly.
- Validate all imported or persisted data at runtime before using it.
- Handle loading, empty, success, and error states intentionally.
- Do not swallow errors. Show recoverable errors to the user and preserve diagnostic context for developers.
- Avoid premature abstractions, speculative features, and broad rewrites.
- Comments should explain decisions or non-obvious constraints, not repeat the code.

## Accessibility and responsive behavior

- Use semantic elements, visible labels, and meaningful accessible names.
- All actions must work with a keyboard and show a visible focus indicator.
- Do not communicate state through color alone.
- Dialogs must manage initial focus, focus containment, Escape, and focus restoration.
- Respect `prefers-reduced-motion`.
- Verify important flows at a 360 px mobile viewport and a desktop viewport.

## Testing expectations

- Unit-test domain rules, date handling, timer calculations, validation, and repository behavior.
- Run the same repository contract suite against both the in-memory and IndexedDB adapters, including an IndexedDB close-and-reopen persistence check.
- Component-test user-visible interactions and error states.
- Use Playwright for the critical journey: create task → plan today → run/complete session → complete task → review day.
- Prefer tests based on roles, labels, and observable outcomes rather than implementation details.
- Use fake timers only where they improve determinism, and restore them after each test.

Once the project is scaffolded, keep the authoritative commands here and update them if tooling changes:

```sh
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

If a listed command does not exist yet, creating it is part of the relevant foundation task; do not report it as successfully verified.

## Data safety

- Never destroy stored user data implicitly during a schema change.
- Version both the IndexedDB schema and JSON export format.
- Export durable user data only; do not include `ActiveTimerState` in backup files.
- Validate imports before modifying current data, then require confirmation. Replace imported stores and clear any active timer in one IndexedDB transaction so the operation either fully succeeds or leaves the existing data unchanged.
- Make destructive actions explicit and difficult to trigger accidentally.
- Tests must not depend on or overwrite a developer's real browser data.

## Definition of done

A plan item is done only when:

- Its user-visible behavior and edge cases meet the relevant requirement.
- Relevant automated tests pass.
- Type checking and linting pass for changed code.
- No known regression is introduced in an already completed flow.
- `PLAN.md` reflects the actual repository state.
- Any intentional deviation or follow-up is documented.

## Change discipline

- Preserve user-authored changes and unrelated work in the repository.
- Do not commit secrets, generated build output, dependency caches, or test artifacts.
- Do not change requirements solely to make an implementation easier.
- Do not claim commands were run when they were not.
- Keep commits, when requested, small and aligned with one completed plan item.
