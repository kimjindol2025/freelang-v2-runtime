/**
 * FreeLang Standard Library: std/date
 *
 * Date and time utilities for manipulation, formatting, and comparison
 */

/**
 * Date range with start and end
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parsed date components
 */
export interface DateComponents {
  year: number;
  month: number;  // 1-12
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * Create date from components
 * @param year Year
 * @param month Month (1-12)
 * @param day Day
 * @param hours Hours (0-23)
 * @param minutes Minutes (0-59)
 * @param seconds Seconds (0-59)
 * @returns Date object
 */
export function create(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): Date {
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Get current date
 * @returns Current date
 */
export function now(): Date {
  return new Date();
}

/**
 * Get current timestamp in milliseconds
 * @returns Milliseconds since epoch
 */
export function timestamp(): number {
  return Date.now();
}

/**
 * Parse date from string
 * @param dateStr Date string (ISO 8601 or common formats)
 * @returns Date object or null
 */
export function parse(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date to string
 * @param date Date object
 * @param format Format string (yyyy-MM-dd HH:mm:ss)
 * @returns Formatted date string
 */
export function format(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Get date components
 * @param date Date object
 * @returns Date components
 */
export function components(date: Date): DateComponents {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds()
  };
}

/**
 * Add days to date
 * @param date Date object
 * @param days Number of days to add
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to date
 * @param date Date object
 * @param months Number of months to add
 * @returns New date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add years to date
 * @param date Date object
 * @param years Number of years to add
 * @returns New date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Get difference in days between two dates
 * @param date1 First date
 * @param date2 Second date
 * @returns Number of days
 */
export function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

/**
 * Check if date is today
 * @param date Date to check
 * @returns true if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if year is leap year
 * @param year Year to check
 * @returns true if leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get number of days in month
 * @param year Year
 * @param month Month (1-12)
 * @returns Number of days
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get day of week (0=Sunday, 6=Saturday)
 * @param date Date object
 * @returns Day of week
 */
export function dayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Get day name
 * @param date Date object
 * @returns Day name (Monday, Tuesday, etc.)
 */
export function dayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Get month name
 * @param date Date object
 * @returns Month name
 */
export function monthName(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[date.getMonth()];
}

/**
 * Check if two dates are same day
 * @param date1 First date
 * @param date2 Second date
 * @returns true if same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Get start of day
 * @param date Date object
 * @returns Date at 00:00:00
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 * @param date Date object
 * @returns Date at 23:59:59
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Create date range
 * @param start Start date
 * @param end End date
 * @returns Date range object
 */
export function range(start: Date, end: Date): DateRange {
  return { start, end };
}

/**
 * Check if date is in range
 * @param date Date to check
 * @param range Date range
 * @returns true if in range
 */
export function isInRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/**
 * Export all date functions as default object
 */
export const date = {
  create,
  now,
  timestamp,
  parse,
  format,
  components,
  addDays,
  addMonths,
  addYears,
  daysBetween,
  isToday,
  isLeapYear,
  daysInMonth,
  dayOfWeek,
  dayName,
  monthName,
  isSameDay,
  startOfDay,
  endOfDay,
  range,
  isInRange
};
