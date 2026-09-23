/**
 * Public surface of the consultations module. Other modules import from here only.
 */
export { createConsultation, updateConsultation } from "@/services/consultations/commands";
export {
  getConsultationForAppointment,
  getConsultationOrThrow,
  listConsultationsForPatient,
} from "@/services/consultations/queries";
export {
  consultationEditableSchema,
  consultationFormSchema,
  consultationIdSchema,
  type ConsultationFormInput,
  type ConsultationUpdateInput,
} from "@/services/consultations/schema";
