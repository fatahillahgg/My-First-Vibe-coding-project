import { useCallback, useEffect, useMemo, useState } from "react";
import { useMomentumRepository } from "../../app/ApplicationDataContext";
import type { Task } from "../../domain/models";
import { TaskPlanningService } from "../../services/TaskPlanningService";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "An unknown storage error occurred";
}

export function useTodayPlan(date: string) {
  const repository = useMomentumRepository();
  const planningService = useMemo(() => new TaskPlanningService(repository), [repository]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [plan, sessions] = await Promise.all([
        planningService.getPlan(date),
        repository.listFocusSessions(),
      ]);
      const counts: Record<string, number> = {};
      sessions.forEach((session) => {
        if (session.outcome === "completed") counts[session.taskId] = (counts[session.taskId] ?? 0) + 1;
      });
      setTasks(plan);
      setSessionCounts(counts);
    } catch (error) {
      console.error("Today plan loading failed", error);
      setLoadError(messageFrom(error));
    } finally {
      setIsLoading(false);
    }
  }, [date, planningService, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const returnToInbox = useCallback(async (taskId: string) => {
    setActionError(null);
    try {
      await planningService.returnToInbox(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Returning a task to Inbox failed", error);
      setActionError(messageFrom(error));
      throw error;
    }
  }, [planningService]);

  const moveTask = useCallback(async (taskId: string, direction: "up" | "down") => {
    setActionError(null);
    try {
      setTasks(await planningService.moveTask(taskId, date, direction));
    } catch (error) {
      console.error("Task reordering failed", error);
      setActionError(messageFrom(error));
      throw error;
    }
  }, [date, planningService]);

  const completeTask = useCallback(async (taskId: string) => {
    setActionError(null);
    try {
      const updated = await planningService.completeTask(taskId);
      setTasks((current) => current.map((task) => task.id === taskId ? updated : task));
    } catch (error) {
      console.error("Task completion failed", error);
      setActionError(messageFrom(error));
    }
  }, [planningService]);

  const reopenTask = useCallback(async (taskId: string) => {
    setActionError(null);
    try {
      const updated = await planningService.reopenTask(taskId, date);
      setTasks((current) => updated.status === "today"
        ? current.map((task) => task.id === taskId ? updated : task)
        : current.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Task reopening failed", error);
      setActionError(messageFrom(error));
    }
  }, [date, planningService]);

  return { tasks, sessionCounts, isLoading, loadError, actionError, reload: load, returnToInbox, moveTask, completeTask, reopenTask };
}
