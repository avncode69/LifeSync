/** Calendar cells represent wall dates, independent of the browser's UTC offset. */
export function calendarDay(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function calendarDayDraft(day: Date) {
  return {
    allDay: true,
    startDate: calendarDay(day),
    endDate: calendarDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12)),
  };
}
