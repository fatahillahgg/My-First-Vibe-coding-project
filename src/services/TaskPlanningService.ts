import type { MomentumRepository } from "../data/MomentumRepository";
import { isLocalDate } from "../domain/date";
import type { Task } from "../domain/models";

export const DAILY_TASK_LIMIT = 5;

export class DailyPlanLimitError extends Error {
  constructor(readonly date: string) {
    super(`The plan for ${date} already has ${DAILY_TASK_LIMIT} incomplete tasks. Return one to the Inbox before adding another.`);
    this.name = "DailyPlanLimitError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was not found.`);
    this.name = "TaskNotFoundError";
  }
}

function assertLocalDate(date: string) {
  if (!isLocalDate(date)) throw new TypeError("A valid local plan date is required");
}

function isPlannedFor(task: Task, date: string) {
  return task.plannedFor === date && (task.status === "today" || task.status === "completed");
}

function sortByPosition(tasks: Task[]) {
  return [...tasks].sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
}

export class TaskPlanningService {
  private planningQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: MomentumRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getPlan(date: string): Promise<Task[]> {
    assertLocalDate(date);
    return sortByPosition((await this.repository.listTasks()).filter((task) => isPlannedFor(task, date)));
  }

  async getIncompleteCount(date: string): Promise<number> {
    return (await this.getPlan(date)).filter((task) => task.status !== "completed").length;
  }

  planTask(taskId: string, date: string): Promise<Task> {
    const operation = this.planningQueue.then(() => this.planTaskAfterPendingOperations(taskId, date));
    this.planningQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  completeTask(taskId: string): Promise<Task> {
    const operation = this.planningQueue.then(async () => {
      const task = await this.repository.getTask(taskId);
      if (!task) throw new TaskNotFoundError(taskId);
      if (task.status === "completed") return task;
      if (task.status !== "today" || task.plannedFor === null) {
        throw new Error("Only a planned task can be completed");
      }
      const completedAt = this.now().toISOString();
      const completed = { ...task, status: "completed" as const, completedAt, updatedAt: completedAt };
      await this.repository.putTask(completed);
      return completed;
    });
    this.planningQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  reopenTask(taskId: string, currentDate: string): Promise<Task> {
    const operation = this.planningQueue.then(async () => {
      assertLocalDate(currentDate);
      const tasks = await this.repository.listTasks();
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task) throw new TaskNotFoundError(taskId);
      if (task.status !== "completed") return task;

      const canRestoreToday = task.plannedFor === currentDate && tasks.filter(
        (candidate) => candidate.id !== task.id && candidate.plannedFor === currentDate && candidate.status === "today",
      ).length < DAILY_TASK_LIMIT;
      const updatedAt = this.now().toISOString();
      const reopened: Task = canRestoreToday
        ? { ...task, status: "today", completedAt: null, updatedAt }
        : {
            ...task,
            status: "inbox",
            plannedFor: null,
            completedAt: null,
            position: tasks.filter((candidate) => candidate.status === "inbox").reduce(
              (highest, candidate) => Math.max(highest, candidate.position),
              -1,
            ) + 1,
            updatedAt,
          };
      await this.repository.putTask(reopened);
      return reopened;
    });
    this.planningQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async planTaskAfterPendingOperations(taskId: string, date: string): Promise<Task> {
    assertLocalDate(date);
    const tasks = await this.repository.listTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    if (isPlannedFor(task, date)) return task;

    const plan = tasks.filter((candidate) => isPlannedFor(candidate, date));
    if (plan.filter((candidate) => candidate.status !== "completed").length >= DAILY_TASK_LIMIT) {
      throw new DailyPlanLimitError(date);
    }

    const planned: Task = {
      ...task,
      status: "today",
      plannedFor: date,
      position: plan.reduce((highest, candidate) => Math.max(highest, candidate.position), -1) + 1,
      updatedAt: this.now().toISOString(),
      completedAt: null,
    };
    await this.repository.putTask(planned);
    return planned;
  }

  async returnToInbox(taskId: string): Promise<Task> {
    const tasks = await this.repository.listTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new TaskNotFoundError(taskId);

    const inboxTask: Task = {
      ...task,
      status: "inbox",
      plannedFor: null,
      position: tasks.filter((candidate) => candidate.status === "inbox").reduce(
        (highest, candidate) => Math.max(highest, candidate.position),
        -1,
      ) + 1,
      updatedAt: this.now().toISOString(),
      completedAt: null,
    };
    await this.repository.putTask(inboxTask);
    return inboxTask;
  }

  async moveTask(taskId: string, date: string, direction: "up" | "down"): Promise<Task[]> {
    const plan = await this.getPlan(date);
    const currentIndex = plan.findIndex((task) => task.id === taskId);
    if (currentIndex === -1) throw new TaskNotFoundError(taskId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= plan.length) return plan;

    [plan[currentIndex], plan[targetIndex]] = [plan[targetIndex], plan[currentIndex]];
    const updatedAt = this.now().toISOString();
    const normalized = plan.map((task, position) => ({ ...task, position, updatedAt }));
    await this.repository.putTasks(normalized);
    return normalized;
  }
}
