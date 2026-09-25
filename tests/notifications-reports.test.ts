import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runCommand } from "@/lib/server/unit";
import { countAuditLogs, listAuditLogs } from "@/services/audit";
import {
  countUnreadNotifications,
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import { getClinicReportsData } from "@/services/reports";

import { randomUUID } from "node:crypto";

const testEmailOrgA = `test-notif-org-a-${Date.now()}@example.com`;
const testEmailOrgB = `test-notif-org-b-${Date.now()}@example.com`;
const profileIdA = randomUUID();
const profileIdB = randomUUID();

let ctxA: OrganizationContext;
let ctxB: OrganizationContext;

async function setupTestContexts() {
  const [profileA, profileB] = await Promise.all([
    prisma.profile.create({
      data: {
        id: profileIdA,
        email: testEmailOrgA,
        fullName: "Dr. Notification A",
      },
    }),
    prisma.profile.create({
      data: {
        id: profileIdB,
        email: testEmailOrgB,
        fullName: "Dr. Notification B",
      },
    }),
  ]);

  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({
      data: {
        name: "Clinic Notif A",
        slug: `clinic-notif-a-${Date.now()}`,
        type: "DENTAL_CLINIC",
        timezone: "Asia/Kolkata",
        currency: "INR",
      },
    }),
    prisma.organization.create({
      data: {
        name: "Clinic Notif B",
        slug: `clinic-notif-b-${Date.now()}`,
        type: "DENTAL_CLINIC",
        timezone: "Asia/Kolkata",
        currency: "INR",
      },
    }),
  ]);

  await Promise.all([
    prisma.membership.create({
      data: {
        organizationId: orgA.id,
        profileId: profileA.id,
        role: "OWNER",
      },
    }),
    prisma.membership.create({
      data: {
        organizationId: orgB.id,
        profileId: profileB.id,
        role: "OWNER",
      },
    }),
  ]);

  ctxA = {
    organizationId: orgA.id,
    profileId: profileA.id,
    organizationName: orgA.name,
    role: "OWNER",
  } as OrganizationContext;

  ctxB = {
    organizationId: orgB.id,
    profileId: profileB.id,
    organizationName: orgB.name,
    role: "OWNER",
  } as OrganizationContext;
}

afterEach(async () => {
  if (ctxA) {
    await prisma.organization.deleteMany({
      where: { id: { in: [ctxA.organizationId, ctxB.organizationId] } },
    });
    await prisma.profile.deleteMany({
      where: { id: { in: [ctxA.profileId, ctxB.profileId] } },
    });
  }
});

describe("notifications and reports services", () => {
  it("creates notifications and marks them as read", async () => {
    await setupTestContexts();

    const notif1 = await runCommand(
      { ctx: ctxA, action: "notification.create", actor: { type: "USER" } },
      (unit) =>
        createNotification(
          ctxA,
          {
            title: "Low stock alert",
            body: "Latex Gloves is low",
            severity: "WARNING",
          },
          unit,
        ),
    );

    const notif2 = await runCommand(
      { ctx: ctxA, action: "notification.create", actor: { type: "USER" } },
      (unit) =>
        createNotification(
          ctxA,
          {
            title: "System Update",
            body: "Maintenance complete",
            severity: "INFO",
          },
          unit,
        ),
    );

    expect(notif1.id).toBeDefined();
    expect(notif2.id).toBeDefined();

    // Check count and listing
    const unreadBefore = await countUnreadNotifications(ctxA);
    expect(unreadBefore).toBe(2);

    const listA = await listNotifications(ctxA);
    expect(listA).toHaveLength(2);

    // Tenant isolation: Org B sees 0
    const listB = await listNotifications(ctxB);
    expect(listB).toHaveLength(0);

    // Mark single notification as read
    await runCommand(
      { ctx: ctxA, action: "notification.read", actor: { type: "USER" } },
      (unit) => markNotificationRead(ctxA, notif1.id, unit),
    );

    const unreadAfterSingle = await countUnreadNotifications(ctxA);
    expect(unreadAfterSingle).toBe(1);

    // Mark all as read
    await runCommand(
      { ctx: ctxA, action: "notification.read_all", actor: { type: "USER" } },
      (unit) => markAllNotificationsRead(ctxA, unit),
    );

    const unreadAfterAll = await countUnreadNotifications(ctxA);
    expect(unreadAfterAll).toBe(0);
  });

  it("lists audit logs with tenant isolation and actor filters", async () => {
    await setupTestContexts();

    // Perform an action in Org A
    await runCommand(
      {
        ctx: ctxA,
        action: "patient.create",
        actor: { type: "USER" },
        entityType: "Patient",
      },
      async (unit) => {
        unit.note({ test: "audit" });
      },
    );

    // Perform an AI action in Org A
    await runCommand(
      {
        ctx: ctxA,
        action: "appointment.create",
        actor: { type: "AI_AGENT", aiToolName: "schedule_appointment" },
        entityType: "Appointment",
      },
      async (unit) => {
        unit.note({ test: "ai" });
      },
    );

    const totalLogsA = await countAuditLogs(ctxA);
    expect(totalLogsA).toBeGreaterThanOrEqual(2);

    const aiLogs = await listAuditLogs(ctxA, { actorType: "AI_AGENT" });
    expect(aiLogs.length).toBeGreaterThanOrEqual(1);
    expect(aiLogs[0]!.actorType).toBe("AI_AGENT");
    expect(aiLogs[0]!.aiToolName).toBe("schedule_appointment");

    // Tenant isolation: Org B sees none of Org A's logs
    const logsB = await listAuditLogs(ctxB);
    expect(logsB).toHaveLength(0);
  });

  it("aggregates clinic reports metrics accurately", async () => {
    await setupTestContexts();

    const reports = await getClinicReportsData(ctxA);
    expect(reports.patientCount).toBe(0);
    expect(reports.financialSummary.totalBilled).toBe(0);
    expect(reports.financialSummary.totalCollected).toBe(0);
    expect(reports.appointmentsSummary.total).toBe(0);
    expect(reports.inventorySummary.totalItems).toBe(0);
  });
});
