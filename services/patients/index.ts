/**
 * Public surface of the patients module. Other modules import from here only.
 */
export {
  createPatient,
  setPatientActive,
  updatePatient,
} from "@/services/patients/commands";
export {
  countActivePatients,
  getPatientOrThrow,
  listPatients,
  listRecentPatients,
} from "@/services/patients/queries";
export { calculateAge, initialsFor } from "@/services/patients/rules";
export {
  patientFilterSchema,
  patientFormSchema,
  patientIdSchema,
  type PatientFilter,
  type PatientFormInput,
} from "@/services/patients/schema";
