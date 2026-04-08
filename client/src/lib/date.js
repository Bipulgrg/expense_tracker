export function yyyyMmDd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function startOfMonthUtc(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

export function endOfMonthUtcExclusive(year, month) {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0));
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
