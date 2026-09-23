/**
 * Public surface of the appointments module. Other modules import from here only.
 */
export {
  cancelAppointment,
  closeAppointment,
  confirmAppointment,
  createAppointment,
  markNoShow,
  startAppointment,
  updateAppointment,
} from "@/services/appointments/commands";
export {
  countUpcomingToday,
  getAppointmentOrThrow,
  listAppointmentsForDay,
  listAppointmentsForPatient,
} from "@/services/appointments/queries";
export {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  canTransition,
  dateKeyInZone,
  isEditable,
  shiftDateKey,
  utcToZonedInputValue,
} from "@/services/appointments/rules";
export type { AppointmentStatus } from "@/lib/db/generated/enums";
export {
  APPOINTMENT_TYPES,
  appointmentDaySchema,
  appointmentFormSchema,
  appointmentIdSchema,
  cancelAppointmentSchema,
  closeAppointmentSchema,
  type AppointmentFormInput,
  type CancelAppointmentInput,
  type CloseAppointmentInput,
} from "@/services/appointments/schema";
