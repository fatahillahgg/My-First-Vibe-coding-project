import type { MomentumRepository } from "../data/MomentumRepository";
import { addLocalDays, compareLocalDates, formatLocalDate, isLocalDate } from "../domain/date";
import type { DailyReview, FocusSession, Task } from "../domain/models";
import { DAILY_TASK_LIMIT, DailyPlanLimitError, TaskNotFoundError } from "./TaskPlanningService";

export interface DailyReviewSummary {
  date: string;
  completedTasks: Task[];
  completedSessions: FocusSession[];
  overdueTasks: Task[];
  review: DailyReview | null;
  history: DailyReview[];
}

function assertDate(date: string) {
  if (!isLocalDate(date)) throw new TypeError("A valid local review date is required");
}

function instantFallsOn(instant: string | null, date: string) {
  return instant !== null && formatLocalDate(new Date(instant)) === date;
}

export class DailyReviewService {
  private operation = Promise.resolve<void>(undefined);

  constructor(
    private readonly repository: MomentumRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSummary(date: string): Promise<DailyReviewSummary> {
    assertDate(date);
    const [tasks, sessions, review, reviews] = await Promise.all([
      this.repository.listTasks(),
      this.repository.listFocusSessions(),
      this.repository.getDailyReview(date),
      this.repository.listDailyReviews(),
    ]);
    return {
      date,
      completedTasks: tasks
        .filter((task) => task.status === "completed" && instantFallsOn(task.completedAt, date))
        .sort((left, right) => (left.completedAt ?? "").localeCompare(right.completedAt ?? "")),
      completedSessions: sessions.filter(
        (session) => session.outcome === "completed" && instantFallsOn(session.endedAt, date),
      ),
      overdueTasks: tasks
        .filter((task) => task.status === "today" && task.completedAt === null && task.plannedFor !== null && compareLocalDates(task.plannedFor, date) < 0)
        .sort((left, right) => (left.plannedFor ?? "").localeCompare(right.plannedFor ?? "") || left.position - right.position),
      review,
      history: reviews.filter((item) => compareLocalDates(item.date, date) < 0).sort((left, right) => right.date.localeCompare(left.date)),
    };
  }

  saveReflection(date: string, reflection: string): Promise<DailyReview> {
    const action = this.operation.then(async () => {
      assertDate(date);
      if (reflection.length > 500) throw new Error("Reflection must be 500 characters or fewer");
      const existing = await this.repository.getDailyReview(date);
      const updatedAt = this.now().toISOString();
      const review: DailyReview = {
        date,
        reflection,
        createdAt: existing?.createdAt ?? updatedAt,
        updatedAt,
      };
      await this.repository.putDailyReview(review);
      return review;
    });
    this.operation = action.then(() => undefined, () => undefined);
    return action;
  }

  moveToTomorrow(taskId: string, currentDate: string): Promise<Task> {
    const action = this.operation.then(async () => {
      assertDate(currentDate);
      const tasks = await this.repository.listTasks();
      const task = this.requireOverdue(tasks, taskId, currentDate);
      const tomorrow = addLocalDays(currentDate, 1);
      const tomorrowPlan = tasks.filter((candidate) => candidate.plannedFor === tomorrow);
      if (tomorrowPlan.filter((candidate) => candidate.status === "today").length >= DAILY_TASK_LIMIT) {
        throw new DailyPlanLimitError(tomorrow);
      }
      const moved: Task = {
        ...task,
        status: "today",
        plannedFor: tomorrow,
        position: tomorrowPlan.reduce((highest, candidate) => Math.max(highest, candidate.position), -1) + 1,
        updatedAt: this.now().toISOString(),
      };
      await this.repository.putTask(moved);
      return moved;
    });
    this.operation = action.then(() => undefined, () => undefined);
    return action;
  }

  returnToInbox(taskId: string, currentDate: string): Promise<Task> {
    const action = this.operation.then(async () => {
      assertDate(currentDate);
      const tasks = await this.repository.listTasks();
      const task = this.requireOverdue(tasks, taskId, currentDate);
      const inboxTask: Task = {
        ...task,
        status: "inbox",
        plannedFor: null,
        position: tasks.filter((candidate) => candidate.status === "inbox").reduce(
          (highest, candidate) => Math.max(highest, candidate.position),
          -1,
        ) + 1,
        updatedAt: this.now().toISOString(),
      };
      await this.repository.putTask(inboxTask);
      return inboxTask;
    });
    this.operation = action.then(() => undefined, () => undefined);
    return action;
  }

  private requireOverdue(tasks: Task[], taskId: string, currentDate: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    if (task.status !== "today" || task.completedAt !== null || task.plannedFor === null || compareLocalDates(task.plannedFor, currentDate) >= 0) {
      throw new Error("Only an overdue incomplete task can be rolled over");
    }
    return task;
  }
}
