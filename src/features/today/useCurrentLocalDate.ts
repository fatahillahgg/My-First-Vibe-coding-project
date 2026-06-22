import { useEffect, useState } from "react";
import { formatLocalDate } from "../../domain/date";

const defaultClock = () => new Date();

export function millisecondsUntilNextLocalDay(now: Date): number {
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, nextDay.getTime() - now.getTime());
}

export function useCurrentLocalDate(clock: () => Date = defaultClock): string {
  const [date, setDate] = useState(() => formatLocalDate(clock()));

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = clock();
      setDate(formatLocalDate(now));
      timer = window.setTimeout(schedule, millisecondsUntilNextLocalDay(now) + 50);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [clock]);

  return date;
}
