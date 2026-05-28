/**
 *
 */
export type CalendarView = "month" | "week" | "day" | "agenda";

/**
 *
 */
export interface TechnicianOption {
  id: string;
  full_name: string;
  initials: string;
}

/**
 *
 */
export interface CalendarDraftRange {
  start: Date;
  end: Date;
}
