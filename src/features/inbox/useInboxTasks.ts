import { useCallback, useEffect, useMemo, useState } from "react";
import { useMomentumRepository } from "../../app/ApplicationDataContext";
import type { Task } from "../../domain/models";
import type { DeletedTaskData } from "../../data/MomentumRepository";
import { DAILY_TASK_LIMIT, TaskPlanningService } from "../../services/TaskPlanningService";
import { useCurrentLocalDate } from "../today/useCurrentLocalDate";
import type { TaskDraft } from "./taskDraft";
import { createInboxTask, updateTaskFromDraft } from "./taskDraft";

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unknown storage error occurred";
}

export function useInboxTasks() {
  const repository = useMomentumRepository();
  const currentDate = useCurrentLocalDate();
  const planningService = useMemo(() => new TaskPlanningService(repository), [repository]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayPlanCount, setTodayPlanCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const storedTasks = await repository.listTasks();
      setTasks(sortTasks(storedTasks.filter((task) => task.status === "inbox")));
      setTodayPlanCount(storedTasks.filter(
        (task) => task.plannedFor === currentDate && task.status === "today",
      ).length);
    } catch (error) {
      console.error("Inbox loading failed", error);
      setLoadError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTask = useCallback(async (draft: TaskDraft) => {
    setActionError(null);
    const nextPosition = tasks.reduce((highest, task) => Math.max(highest, task.position), -1) + 1;
    const task = createInboxTask(draft, nextPosition);
    try {
      await repository.putTask(task);
      setTasks((current) => sortTasks([...current, task]));
      return task;
    } catch (error) {
      console.error("Task creation failed", error);
      setActionError(errorMessage(error));
      throw error;
    }
  }, [repository, tasks]);

  const updateTask = useCallback(async (task: Task, draft: TaskDraft) => {
    setActionError(null);
    const updated = updateTaskFromDraft(task, draft);
    try {
      await repository.putTask(updated);
      setTasks((current) => sortTasks(current.map((item) => item.id === updated.id ? updated : item)));
      return updated;
    } catch (error) {
      console.error("Task update failed", error);
      setActionError(errorMessage(error));
      throw error;
    }
  }, [repository]);

  const deleteTask = useCallback(async (task: Task) => {
    setActionError(null);
    try {
      const deleted = await repository.deleteTask(task.id);
      if (!deleted) throw new Error("Task was already deleted");
      setTasks((current) => current.filter((item) => item.id !== task.id));
      return deleted;
    } catch (error) {
      console.error("Task deletion failed", error);
      setActionError(errorMessage(error));
      throw error;
    }
  }, [repository]);

  const restoreTask = useCallback(async (deleted: DeletedTaskData) => {
    setActionError(null);
    try {
      await repository.restoreDeletedTask(deleted);
      const task = deleted.task;
      setTasks((current) => sortTasks([...current.filter((item) => item.id !== task.id), task]));
    } catch (error) {
      console.error("Task restore failed", error);
      setActionError(errorMessage(error));
      throw error;
    }
  }, [repository]);

  const planTaskToday = useCallback(async (task: Task) => {
    setActionError(null);
    try {
      const planned = await planningService.planTask(task.id, currentDate);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setTodayPlanCount((count) => count + 1);
      return planned;
    } catch (error) {
      console.error("Planning a task for today failed", error);
      setActionError(errorMessage(error));
      throw error;
    }
  }, [currentDate, planningService]);

  return {
    tasks,
    todayPlanCount,
    isTodayPlanFull: todayPlanCount >= DAILY_TASK_LIMIT,
    isLoading,
    loadError,
    actionError,
    reload: load,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    planTaskToday,
  };
}
