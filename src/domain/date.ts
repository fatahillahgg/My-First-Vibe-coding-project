const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDate(value: string): LocalDateParts | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isLocalDate(value: unknown): value is string {
  return typeof value === "string" && parseLocalDate(value) !== null;
}

export function addLocalDays(value: string, amount: number): string {
  const parts = parseLocalDate(value);
  if (!parts || !Number.isInteger(amount)) {
    throw new TypeError("A valid local date and an integer day amount are required");
  }

  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function compareLocalDates(left: string, right: string): -1 | 0 | 1 {
  if (!isLocalDate(left) || !isLocalDate(right)) {
    throw new TypeError("Both values must be valid local dates");
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
