import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runCommand, type UnitOfWork } from "@/lib/server/unit";
import { createPatientTool, updatePatientTool } from "@/lib/ai/tools/patient.tools";
import { updateAppointmentTool } from "@/lib/ai/tools/appointment.tools";
import { createPatient } from "@/services/patients";
import { createAppointment } from "@/services/appointments";

const TEST_SLUG_PREFIX = "completeness-test-";
const TEST_PROFILE_ID = "ffffffff-0000-4000-8000-000000000088";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "completeness-test@example.com" },
    update: {},
  });

  const organization = await prisma.organization.create({
    data: {
      name,
      slug: `${TEST_SLUG_PREFIX}${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timezone: "Asia/Kolkata",
    },
  });

  return {
    user: { id: TEST_PROFILE_ID } as OrganizationContext["user"],
    profileId: TEST_PROFILE_ID,
    organizationId: organization.id,
    organizationName: organization.name,
    role: "OWNER",
  };
}

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("Mandatory Information Completeness & Safeguards", () => {
  it("create_patient rejects creation when contact details (phone and email) are missing", async () => {
    const ctx = await makeOrgContext("Incomplete Patient Org");

    const prepared = createPatientTool.prepare({
      fullName: "Abstract Patient",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = (await runCommand(
      { ctx, action: "ai.create_patient.test", actor: { type: "USER" } },
      (unit: UnitOfWork) => prepared.invoke(ctx, { unit }),
    )) as { rejected?: boolean; error?: string };

    expect(result.rejected).toBe(true);
    expect(result.error).toContain("Incomplete patient registration details");
    expect(result.error).toContain("phone number or email address is required");
  });

  it("create_patient succeeds when contact info and details are provided", async () => {
    const ctx = await makeOrgContext("Complete Patient Org");

    const prepared = createPatientTool.prepare({
      fullName: "Complete Patient",
      phone: "+91 9876543210",
      email: "complete.patient@example.com",
      gender: "FEMALE",
      dateOfBirth: "1992-06-15",
      addressLine: "123 Medical Park",
      city: "Bangalore",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = (await runCommand(
      { ctx, action: "ai.create_patient.test", actor: { type: "USER" } },
      (unit: UnitOfWork) => prepared.invoke(ctx, { unit }),
    )) as { id: string; fullName: string; phone: string; email: string };

    expect(result.id).toBeDefined();
    expect(result.fullName).toBe("Complete Patient");
    expect(result.phone).toBe("+91 9876543210");
    expect(result.email).toBe("complete.patient@example.com");

    const saved = await prisma.patient.findFirst({
      where: { id: result.id, organizationId: ctx.organizationId },
    });
    expect(saved?.phone).toBe("+91 9876543210");
    expect(saved?.email).toBe("complete.patient@example.com");
    expect(saved?.gender).toBe("FEMALE");
    expect(saved?.city).toBe("Bangalore");
  });

  it("update_patient preserves unedited fields instead of clearing them to null", async () => {
    const ctx = await makeOrgContext("Update Patient Org");

    // Create an initial patient with full records
    const patient = await runCommand(
      { ctx, action: "patient.create", actor: { type: "USER" } },
      (unit: UnitOfWork) =>
        createPatient(
          ctx,
          {
            fullName: "Ananya Sharma",
            phone: "+91 9988776655",
            email: "ananya@example.com",
            gender: "FEMALE",
            dateOfBirth: "1995-04-12",
            addressLine: "45 Lotus Garden",
            city: "Hyderabad",
            emergencyContactName: "Raj Sharma",
            emergencyContactPhone: "+91 9988776600",
            notes: "Known mild pollen allergy",
          },
          unit,
        ),
    );

    // Call update_patient tool ONLY updating notes and city
    const prepared = updatePatientTool.prepare({
      id: patient.id,
      city: "Secunderabad",
      notes: "Pollen allergy resolved; seasonal asthma noted",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    await runCommand(
      { ctx, action: "ai.update_patient.test", actor: { type: "USER" } },
      (unit: UnitOfWork) => prepared.invoke(ctx, { unit }),
    );

    // Verify in database that phone, email, dateOfBirth, and emergency contact were PRESERVED
    const updated = await prisma.patient.findFirst({
      where: { id: patient.id, organizationId: ctx.organizationId },
    });

    expect(updated?.fullName).toBe("Ananya Sharma");
    expect(updated?.phone).toBe("+91 9988776655");
    expect(updated?.email).toBe("ananya@example.com");
    expect(updated?.gender).toBe("FEMALE");
    expect(updated?.dateOfBirth?.toISOString().slice(0, 10)).toBe("1995-04-12");
    expect(updated?.addressLine).toBe("45 Lotus Garden");
    expect(updated?.city).toBe("Secunderabad"); // updated
    expect(updated?.emergencyContactName).toBe("Raj Sharma");
    expect(updated?.emergencyContactPhone).toBe("+91 9988776600");
    expect(updated?.notes).toBe("Pollen allergy resolved; seasonal asthma noted"); // updated
  });

  it("update_appointment reschedules an appointment while preserving existing type, duration, and notes", async () => {
    const ctx = await makeOrgContext("Update Appointment Org");

    const patient = await runCommand(
      { ctx, action: "patient.create", actor: { type: "USER" } },
      (unit: UnitOfWork) =>
        createPatient(
          ctx,
          {
            fullName: "Rohan Gupta",
            phone: "+91 9123456780",
            gender: "MALE",
          },
          unit,
        ),
    );

    const initialAppointment = await runCommand(
      { ctx, action: "appointment.create", actor: { type: "USER" } },
      (unit: UnitOfWork) =>
        createAppointment(
          ctx,
          {
            patientId: patient.id,
            scheduledAt: "2026-10-10T10:00",
            durationMinutes: 45,
            type: "FOLLOW_UP",
            notes: "Check recovery progress",
          },
          unit,
        ),
    );

    // Call update_appointment tool to reschedule to a new time
    const prepared = updateAppointmentTool.prepare({
      appointmentId: initialAppointment.id,
      scheduledAt: "2026-10-12T14:30",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    await runCommand(
      { ctx, action: "ai.update_appointment.test", actor: { type: "USER" } },
      (unit: UnitOfWork) => prepared.invoke(ctx, { unit }),
    );

    const saved = await prisma.appointment.findFirst({
      where: { id: initialAppointment.id, organizationId: ctx.organizationId },
    });

    expect(saved?.durationMinutes).toBe(45); // preserved
    expect(saved?.type).toBe("FOLLOW_UP"); // preserved
    expect(saved?.notes).toBe("Check recovery progress"); // preserved
    expect(saved?.scheduledAt.toISOString()).toContain("2026-10-12"); // rescheduled
  });
});
