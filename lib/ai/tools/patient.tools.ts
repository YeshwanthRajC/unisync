import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  createPatient,
  getPatientOrThrow,
  listPatients,
  updatePatient,
} from "@/services/patients";

export const searchPatientsTool = defineTool({
  name: "search_patients",
  description: "Search for registered clinic patients by full name, phone number, or email address.",
  permission: "patient.read",
  audit: "patient.read",
  mode: "read",
  input: z.object({
    query: z.string().describe("Search term to match patient name, phone number, or email address."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const patients = await listPatients(ctx, { search: input.query, status: "ALL" }, db);
    return patients.slice(0, 10).map((p) => ({
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
      email: p.email,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      isActive: p.isActive,
    }));
  },
});

export const getPatientDetailsTool = defineTool({
  name: "get_patient_details",
  description: "Retrieve comprehensive details and contact info for a specific patient by ID.",
  permission: "patient.read",
  audit: "patient.read",
  mode: "read",
  input: z.object({
    patientId: z.string().describe("The UUID identifier of the patient."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const p = await getPatientOrThrow(ctx, input.patientId, db);
    return {
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
      email: p.email,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      gender: p.gender,
      addressLine: p.addressLine,
      city: p.city,
      emergencyContactName: p.emergencyContactName,
      emergencyContactPhone: p.emergencyContactPhone,
      notes: p.notes,
      isActive: p.isActive,
    };
  },
});

export const createPatientTool = defineTool({
  name: "create_patient",
  description:
    "Register a new patient into the clinic system with complete contact details and demographics. IMPORTANT: Never invoke this tool with only a name or without contact details. You MUST ask the user for phone number, email address, date of birth, gender, and residential address before registering a patient, unless the user explicitly requested to proceed without them.",
  permission: "patient.create",
  audit: "patient.create",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Register new patient "${input.fullName}"${input.phone ? ` (Phone: ${input.phone})` : ""}`,
  },
  input: z.object({
    fullName: z.string().min(1).describe("The patient's full legal name."),
    phone: z.string().optional().describe("Primary telephone or mobile number."),
    email: z.string().optional().describe("Email address for appointments and billing."),
    dateOfBirth: z.string().optional().describe("Date of birth in YYYY-MM-DD format."),
    gender: z
      .enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"])
      .optional()
      .describe("Patient gender identity."),
    addressLine: z.string().optional().describe("Street address."),
    city: z.string().optional().describe("City."),
    state: z.string().optional().describe("State or province."),
    postalCode: z.string().optional().describe("Postal or ZIP code."),
    emergencyContactName: z.string().optional().describe("Emergency contact person name."),
    emergencyContactPhone: z.string().optional().describe("Emergency contact phone number."),
    notes: z.string().optional().describe("Clinical notes or initial observations."),
    allowMissingContact: z
      .boolean()
      .optional()
      .describe(
        "Set to true only if the user explicitly confirms that the patient has no phone number or email address.",
      ),
  }),
  execute: async ({ input, ctx, unit }) => {
    // Elicitation guard: prevent creating skeleton profiles with missing contact info
    if (!input.phone && !input.email && !input.allowMissingContact) {
      return {
        rejected: true,
        error:
          "Incomplete patient registration details. A phone number or email address is required so the clinic can contact and verify the patient. Please ask the user to provide the patient's contact details (phone, email, date of birth, gender, and address) before creating the record.",
      };
    }

    const patient = await createPatient(
      ctx,
      {
        fullName: input.fullName,
        phone: input.phone || "",
        email: input.email || "",
        dateOfBirth: input.dateOfBirth || "",
        gender: input.gender ?? "UNDISCLOSED",
        addressLine: input.addressLine || "",
        city: input.city || "",
        state: input.state || "",
        postalCode: input.postalCode || "",
        emergencyContactName: input.emergencyContactName || "",
        emergencyContactPhone: input.emergencyContactPhone || "",
        notes: input.notes || "",
      },
      unit,
    );
    return {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      email: patient.email,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null,
      message: `Patient ${patient.fullName} successfully registered with complete profile.`,
    };
  },
});

export const updatePatientTool = defineTool({
  name: "update_patient",
  description:
    "Update an existing patient's contact information, address, demographics, or clinical notes. Only modifies the specific fields provided and preserves all other existing patient data.",
  permission: "patient.update",
  audit: "patient.update",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Update profile details for patient "${input.fullName || input.id}" (ID: ${input.id})`,
  },
  input: z.object({
    id: z.string().describe("UUID of the patient to update."),
    fullName: z.string().min(1).optional().describe("The patient's updated full legal name (optional)."),
    phone: z.string().optional().describe("Primary telephone or mobile number."),
    email: z.string().optional().describe("Email address."),
    dateOfBirth: z.string().optional().describe("Date of birth in YYYY-MM-DD format."),
    gender: z
      .enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"])
      .optional()
      .describe("Patient gender identity."),
    addressLine: z.string().optional().describe("Street address."),
    city: z.string().optional().describe("City."),
    state: z.string().optional().describe("State or province."),
    postalCode: z.string().optional().describe("Postal or ZIP code."),
    emergencyContactName: z.string().optional().describe("Emergency contact person name."),
    emergencyContactPhone: z.string().optional().describe("Emergency contact phone number."),
    notes: z.string().optional().describe("Clinical notes."),
  }),
  execute: async ({ input, ctx, unit }) => {
    // Preserve existing patient data so unmentioned fields are not erased
    const existing = await getPatientOrThrow(ctx, input.id, unit.db);

    const patient = await updatePatient(
      ctx,
      input.id,
      {
        fullName: input.fullName ?? existing.fullName,
        phone: input.phone !== undefined ? input.phone : (existing.phone ?? ""),
        email: input.email !== undefined ? input.email : (existing.email ?? ""),
        dateOfBirth:
          input.dateOfBirth !== undefined
            ? input.dateOfBirth
            : (existing.dateOfBirth ? existing.dateOfBirth.toISOString().slice(0, 10) : ""),
        gender: input.gender ?? existing.gender,
        addressLine:
          input.addressLine !== undefined ? input.addressLine : (existing.addressLine ?? ""),
        city: input.city !== undefined ? input.city : (existing.city ?? ""),
        state: input.state !== undefined ? input.state : (existing.state ?? ""),
        postalCode:
          input.postalCode !== undefined ? input.postalCode : (existing.postalCode ?? ""),
        emergencyContactName:
          input.emergencyContactName !== undefined
            ? input.emergencyContactName
            : (existing.emergencyContactName ?? ""),
        emergencyContactPhone:
          input.emergencyContactPhone !== undefined
            ? input.emergencyContactPhone
            : (existing.emergencyContactPhone ?? ""),
        notes: input.notes !== undefined ? input.notes : (existing.notes ?? ""),
      },
      unit,
    );
    return {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      email: patient.email,
      updated: true,
    };
  },
});
