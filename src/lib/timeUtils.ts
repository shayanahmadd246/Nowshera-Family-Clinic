/**
 * Utility functions for 30-minute clinic appointment slots and time formatting
 */

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatTimeRange12h(start24: string, end24: string): string {
  return `${formatTime12h(start24)} – ${formatTime12h(end24)}`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex] || 'Unknown';
}
