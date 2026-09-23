import type { AppointmentStatus } from "@/lib/db/generated/enums";

/**
 * Pure, testable logic for the appointments module.
 *
 * The state machine itself: `COMPLETED` (via `closeAppointment`) is the one
 * transition gated by `HumanIntent` at the type level, not by this map — see
 * `services/appointments/commands.ts`. This map is the business rule ("can a
 * scheduled visit even reach that state from here?"), which is a different
 * question from "may a person, specifically, make it happen?".
 */
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Only a still-open appointment's schedule/type/notes may be edited. */
export function isEditable(status: AppointmentStatus): boolean {
  return status === "SCHEDULED" || status === "CONFIRMED";
}

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CLEANING: "Cleaning",
  FILLING: "Filling",
  EXTRACTION: "Extraction",
  ROOT_CANAL: "Root canal",
  CROWN_OR_BRIDGE: "Crown or bridge",
  ORTHODONTIC: "Orthodontic",
  FOLLOW_UP: "Follow-up",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

/** yyyy-mm-dd in a specific IANA zone, for grouping and the day-view URL. */
export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Minutes to ADD to a UTC instant to get the zone's local wall-clock time,
 * evaluated at that instant (so it already accounts for DST on that date).
 * Standard `Intl` round-trip: format the instant in the zone, then read back
 * what UTC instant that wall-clock reading corresponds to.
 */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** The start/end instants (UTC) of a given yyyy-mm-dd calendar day in a zone. */
export function dayBoundsInZone(
  dateKey: string,
  timeZone: string,
): { start: Date; end: Date } {
  const naiveStart = new Date(`${dateKey}T00:00:00Z`);
  // One correction pass is enough: a zone's offset changes at most once near a
  // given midnight, and this reads the offset that actually applies there.
  const offset = offsetMinutesAt(naiveStart, timeZone);
  const start = new Date(naiveStart.getTime() - offset * 60_000);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  return { start, end };
}

/**
 * Interpret a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") as
 * wall-clock time IN the organization's timezone, and return the UTC instant
 * it refers to. Every appointment is stored in UTC; this is the one place a
 * naive wall-clock string crosses into that.
 */
export function zonedTimeToUtc(localDateTime: string, timeZone: string): Date {
  const naive = new Date(`${localDateTime}:00Z`);
  const offset = offsetMinutesAt(naive, timeZone);
  return new Date(naive.getTime() - offset * 60_000);
}

/** The inverse of `zonedTimeToUtc`: an instant, formatted as the
 * "YYYY-MM-DDTHH:mm" wall-clock string an `<input type="datetime-local">`
 * expects, in the organization's zone — for prefilling the edit form. */
export function utcToZonedInputValue(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Calendar-day arithmetic on a yyyy-mm-dd key, independent of any timezone —
 * this is pure date-triplet math, not an instant, so no offset applies. */
export function shiftDateKey(dateKey: string, days: number): string {
  const shifted = new Date(`${dateKey}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
