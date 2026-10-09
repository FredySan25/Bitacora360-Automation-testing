/*
 * Calendar days and months as the app handles them: "YYYY-MM-DD" and "YYYY-MM"
 * keys in the local time zone, which is also the browser's.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "1950-03", from a year and a month counted from 1. */
export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

/** "1950-03-31", the form a date input takes. */
export function dayKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${pad(day)}`;
}

function toDayKey(date: Date): string {
  return dayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Today, or a day counted from it. */
export function todayKey(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return toDayKey(date);
}

/** The current month, or one counted from it. */
export function currentMonthKey(monthsFromNow = 0): string {
  const today = new Date();
  return addMonths(monthKey(today.getFullYear(), today.getMonth() + 1), monthsFromNow);
}

export function addMonths(month: string, months: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + months, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}

export function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one
  return toDayKey(new Date(year, monthNumber, 0));
}
