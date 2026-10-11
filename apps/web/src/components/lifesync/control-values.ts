/** Parse the date part without UTC conversion or rollover of invalid calendar dates. */
export function parseControlDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

export function formatControlDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
