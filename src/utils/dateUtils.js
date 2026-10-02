/**
 * Date and time formatting utilities for BizSaathi
 * Ensures all UTC timestamps from backend/database are parsed as UTC
 * and rendered accurately in the user's local browser timezone.
 */

export function parseUtcDate(dateVal) {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    let s = dateVal.trim();
    if (!s) return new Date();

    // Standardize SQL format "YYYY-MM-DD HH:MM:SS" to ISO format "YYYY-MM-DDTHH:MM:SS"
    if (s.includes(' ') && !s.includes('T')) {
      s = s.replace(' ', 'T');
    }

    // If string has no timezone indicator (no 'Z' and no '+/-HH:MM'),
    // append 'Z' so the browser parses it as UTC instead of local time.
    if (!s.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(s)) {
      s += 'Z';
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(dateVal);
}

/**
 * Formats a Date object or UTC date string into a localized 12-hour time:
 * e.g., "11:05 pm", "09:30 am"
 */
export function formatCurrentTime(dateVal = new Date()) {
  try {
    const d = parseUtcDate(dateVal);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/**
 * Formats conversation updated/created timestamp for cards in local timezone:
 * "Today, 11:05 pm", "Yesterday, 10:57 pm", or "Sep 30, 2026"
 */
export function formatConversationDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = parseUtcDate(dateStr);
    const now = new Date();

    // Compare date parts in user's local timezone
    const isToday = (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    );

    if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
