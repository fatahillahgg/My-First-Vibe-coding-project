import { describe, expect, it } from "vitest";
import { addLocalDays, compareLocalDates, formatLocalDate, isIsoTimestamp, isLocalDate, parseLocalDate } from "./date";

describe("local date utilities", () => {
  it("formats with local calendar fields rather than UTC fields", () => {
    const nearMidnight = new Date(2026, 5, 20, 0, 15);
    expect(formatLocalDate(nearMidnight)).toBe("2026-06-20");
  });

  it.each(["2026-02-29", "2026-13-01", "2026-00-10", "20-01-01", "2026-04-31"])(
    "rejects invalid local date %s",
    (value) => expect(isLocalDate(value)).toBe(false),
  );

  it("accepts leap days and exposes their calendar parts", () => {
    expect(parseLocalDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it("moves over month and year boundaries without time-zone arithmetic", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("compares validated local dates", () => {
    expect(compareLocalDates("2026-06-19", "2026-06-20")).toBe(-1);
    expect(compareLocalDates("2026-06-20", "2026-06-20")).toBe(0);
    expect(compareLocalDates("2026-06-21", "2026-06-20")).toBe(1);
  });

  it("recognizes canonical ISO timestamps", () => {
    expect(isIsoTimestamp("2026-06-20T14:00:00.000Z")).toBe(true);
    expect(isIsoTimestamp("2026-06-20 14:00:00")).toBe(false);
  });
});
