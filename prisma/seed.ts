/**
 * Development seed: fills ONE named account's organization with sample data.
 *
 *   npm run db:seed -- you@example.com     # fill
 *   npm run db:seed -- you@example.com --clear   # empty it again
 *
 * Two properties this script is built around.
 *
 * FIRST: it populates the organization the named user ALREADY has, rather than
 * creating one of its own. An earlier version created a separate demo clinic,
 * which was quietly broken — a user who had completed onboarding then had two
 * memberships, and the application resolves the oldest, so they would have
 * landed in their own empty organization and never seen the sample data.
 *
 * SECOND: it cannot reach any other tenant. Everything it writes carries the
 * resolved organizationId, and every other organization in the database is
 * untouched. That is not a promise this script makes carefully — it is enforced
 * by the tenant tripwire, which throws on any query that omits the filter. So a
 * second person signing up gets a genuinely empty workspace, and sample data
 * cannot leak into it.
 *
 * It refuses to fabricate a profile: `Profile.id` is the Supabase Auth user id,
 * so invented data would belong to nobody who can sign in, which is worse than
 * no data because it looks like the app works.
 *
 * The data is shaped to make every screen and the assistant genuinely testable:
 * appointments in the past and future, bills in three payment states, inventory
 * below its minimum, and follow-ups that are actually overdue.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { PrismaClient } from "../lib/db/generated/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Absent is fine.
  }
}

const CLEAR_ONLY = process.argv.includes("--clear");

if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to run: NODE_ENV is production. This script replaces the business\n" +
      "data inside an organization and is for development only.",
  );
  process.exit(1);
}

const adminEmail = (
  process.argv.find((arg) => arg.includes("@")) ??
  process.env.SEED_ADMIN_EMAIL ??
  ""
).trim();

if (!adminEmail) {
  console.error(
    "Usage:\n" +
      "  npm run db:seed -- you@example.com            fill with sample data\n" +
      "  npm run db:seed -- you@example.com --clear    empty it again\n\n" +
      "Pass the email of an account that has already signed up AND created its\n" +
      "organization. Sample data goes into that one organization only; every\n" +
      "other account keeps an empty workspace.",
  );
  process.exit(1);
}

/**
 * Resolve the Supabase Auth user id for an email.
 *
 * Read directly from `auth.users` over the direct connection: Prisma does not
 * model the auth schema, and the Admin API would need the service role key,
 * which is deliberately not configured.
 */
async function findAuthUser(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query<{ id: string; email: string }>(
      "select id, email from auth.users where lower(email) = lower($1) limit 1",
      [email],
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Deterministic-ish sample data
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Meera", "Arjun", "Kavya",
  "Rajesh", "Sneha", "Karthik", "Divya", "Suresh", "Lakshmi", "Nikhil",
  "Pooja", "Ravi", "Anjali", "Manoj", "Deepa", "Sanjay", "Nisha", "Arun",
  "Shreya", "Vijay",
];
const LAST_NAMES = [
  "Sharma", "Nair", "Reddy", "Iyer", "Menon", "Rao", "Kumar", "Pillai",
  "Desai", "Bhat", "Joshi", "Verma", "Chandran", "Mathew", "Krishnan",
];

const TREATMENTS: Array<{ name: string; price: number }> = [
  { name: "Consultation", price: 500 },
  { name: "Scaling and polishing", price: 1500 },
  { name: "Composite filling", price: 2500 },
  { name: "Root canal treatment", price: 8000 },
  { name: "Tooth extraction", price: 2000 },
  { name: "Porcelain crown", price: 12000 },
  { name: "Teeth whitening", price: 6000 },
  { name: "Dental X-ray", price: 400 },
];

/** Small deterministic PRNG so repeated seeds produce the same clinic. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = makeRandom(20260923);

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() from an empty list");
  return item;
}

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  // Clinic hours are local (Asia/Kolkata, UTC+5:30); store UTC.
  date.setUTCHours(hour - 5, minute - 30, 0, 0);
  return date;
}

async function main() {
  const authUser = await findAuthUser(adminEmail);

  if (!authUser) {
    console.error(
      `No Supabase Auth user found for "${adminEmail}".\n\n` +
        "Sign up in the app first (npm run dev, then create an account), and run\n" +
        "this again with that email. The seed deliberately will not fabricate a\n" +
        "profile: data nobody can sign in and see is worse than no data.",
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

  /*
   * Resolve the organization this user ALREADY belongs to.
   *
   * Scoped by profileId, which is the one legitimate way to query Membership —
   * "which organization does this person belong to?" cannot be filtered by the
   * organization it is looking up. See lib/db/tenant-guard.ts.
   */
  const membership = await prisma.membership.findFirst({
    where: { profileId: authUser.id, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    console.error(
      `${authUser.email} has signed up but has no organization yet.\n\n` +
        "Open the app, finish creating your organization, then run this again.\n" +
        "The sample data goes INTO your organization rather than creating one of\n" +
        "its own — otherwise you would end up with two, and the app would show you\n" +
        "the empty one.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const organization = membership.organization;
  const organizationId = organization.id;
  const actor = authUser.id;

  /*
   * Everything below is scoped to this organizationId. No other tenant is
   * reachable — not by convention, but because the tenant tripwire throws on any
   * query that omits the filter. A second person who signs up gets a genuinely
   * empty workspace.
   */
  const existing = await prisma.patient.count({ where: { organizationId } });

  if (existing > 0 || CLEAR_ONLY) {
    console.log(
      `Clearing existing business data from "${organization.name}" (${existing} patients) ...`,
    );
    // Patients cascade to appointments, consultations, prescriptions, bills,
    // payments, follow-ups and emails. Inventory cascades to its movements.
    // The organization, the profile and the membership are never touched.
    await prisma.patient.deleteMany({ where: { organizationId } });
    await prisma.inventoryItem.deleteMany({ where: { organizationId } });
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.aIConversation.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
  }

  if (CLEAR_ONLY) {
    await prisma.$disconnect();
    console.log(
      `\n"${organization.name}" is now empty. Every screen will show its empty state.`,
    );
    return;
  }

  console.log(`Seeding "${organization.name}" for ${authUser.email} ...`);

  // --- Patients ------------------------------------------------------------
  const patients = [];
  for (let index = 0; index < 25; index += 1) {
    const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    patients.push(
      await prisma.patient.create({
        data: {
          organizationId,
          fullName,
          phone: `+91 9${Math.floor(random() * 900000000 + 100000000)}`,
          email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          dateOfBirth: new Date(
            Date.UTC(1960 + Math.floor(random() * 50), Math.floor(random() * 12), 1 + Math.floor(random() * 28)),
          ),
          gender: pick(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const),
          city: "Bengaluru",
          state: "Karnataka",
          notes: random() > 0.75 ? "Prefers morning appointments." : null,
        },
      }),
    );
  }
  console.log(`  ${patients.length} patients`);

  // --- Appointments --------------------------------------------------------
  // Past ones are CLOSED properly: closedAt AND closedByProfileId together, or
  // the CHECK constraint refuses the row. That is the point of the constraint.
  const appointments = [];
  for (let index = 0; index < 40; index += 1) {
    const patient = pick(patients);
    const isPast = index < 24;
    const offset = isPast
      ? -1 - Math.floor(random() * 45)
      : Math.floor(random() * 21);
    const scheduledAt = daysFromNow(offset, 9 + Math.floor(random() * 8), random() > 0.5 ? 0 : 30);

    let status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    if (isPast) {
      const roll = random();
      status = roll < 0.75 ? "COMPLETED" : roll < 0.88 ? "CANCELLED" : "NO_SHOW";
    } else {
      status = random() < 0.45 ? "CONFIRMED" : "SCHEDULED";
    }

    appointments.push(
      await prisma.appointment.create({
        data: {
          organizationId,
          patientId: patient.id,
          scheduledAt,
          durationMinutes: pick([30, 30, 45, 60]),
          type: pick([
            "CONSULTATION", "CLEANING", "FILLING", "EXTRACTION",
            "ROOT_CANAL", "CROWN_OR_BRIDGE", "FOLLOW_UP",
          ] as const),
          status,
          createdByProfileId: actor,
          ...(status === "COMPLETED"
            ? {
                closedAt: new Date(scheduledAt.getTime() + 60 * 60 * 1000),
                closedByProfileId: actor,
                outcomeNotes: "Treatment completed. Patient advised on aftercare.",
              }
            : {}),
          ...(status === "CANCELLED"
            ? {
                cancelledAt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
                cancellationReason: "Patient rescheduled.",
              }
            : {}),
        },
      }),
    );
  }
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  console.log(`  ${appointments.length} appointments (${completed.length} completed)`);

  // --- Consultations, prescriptions ---------------------------------------
  let prescriptionCount = 0;
  for (const appointment of completed) {
    const consultation = await prisma.consultation.create({
      data: {
        organizationId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        consultedAt: appointment.scheduledAt,
        chiefComplaint: pick([
          "Sensitivity to cold", "Pain in lower right molar",
          "Routine check-up", "Bleeding gums", "Chipped front tooth",
        ]),
        diagnosis: pick([
          "Dental caries, occlusal surface", "Gingivitis",
          "Enamel erosion", "Pulpitis, irreversible", "Healthy dentition",
        ]),
        treatment: pick(TREATMENTS).name,
        followUpNeeded: random() > 0.6,
        recordedByProfileId: actor,
      },
    });

    if (random() > 0.45) {
      await prisma.prescription.create({
        data: {
          organizationId,
          patientId: appointment.patientId,
          consultationId: consultation.id,
          issuedAt: appointment.scheduledAt,
          instructions: "Complete the full course. Return if pain persists.",
          items: {
            create: [
              { medicine: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "Three times daily", durationDays: 5, position: 0 },
              { medicine: "Ibuprofen 400mg", dosage: "1 tablet", frequency: "As needed for pain", durationDays: 3, position: 1 },
            ],
          },
        },
      });
      prescriptionCount += 1;
    }
  }
  console.log(`  ${completed.length} consultations, ${prescriptionCount} prescriptions`);

  // --- Bills and payments --------------------------------------------------
  // Three payment states, so the billing screens have something to show:
  // fully confirmed, partially confirmed, and nothing paid.
  let billNumber = 1;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  for (const appointment of completed) {
    const lineItems = [pick(TREATMENTS)];
    if (random() > 0.6) lineItems.push(pick(TREATMENTS));

    const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);
    const discount = random() > 0.8 ? 500 : 0;
    const total = subtotal - discount;

    const bill = await prisma.bill.create({
      data: {
        organizationId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        number: `INV-${String(billNumber++).padStart(4, "0")}`,
        status: "ISSUED",
        issuedAt: appointment.scheduledAt,
        subtotal,
        discount,
        tax: 0,
        total,
        createdByProfileId: actor,
        items: {
          create: lineItems.map((item, position) => ({
            description: item.name,
            quantity: 1,
            unitPrice: item.price,
            lineTotal: item.price,
            position,
          })),
        },
      },
    });

    const roll = random();
    if (roll < 0.55) {
      // Fully paid — CONFIRMED requires both fields, per the CHECK constraint.
      await prisma.payment.create({
        data: {
          organizationId,
          billId: bill.id,
          amount: total,
          method: pick(["CASH", "UPI", "CARD"] as const),
          status: "CONFIRMED",
          recordedByProfileId: actor,
          recordedAt: appointment.scheduledAt,
          confirmedAt: appointment.scheduledAt,
          confirmedByProfileId: actor,
        },
      });
      paidCount += 1;
    } else if (roll < 0.8) {
      // Part payment confirmed, the remainder outstanding.
      await prisma.payment.create({
        data: {
          organizationId,
          billId: bill.id,
          amount: Math.round(total / 2),
          method: "UPI",
          status: "CONFIRMED",
          recordedByProfileId: actor,
          recordedAt: appointment.scheduledAt,
          confirmedAt: appointment.scheduledAt,
          confirmedByProfileId: actor,
        },
      });
      partialCount += 1;
    } else {
      // Recorded but NOT confirmed: this is what the Confirm Payment screen is
      // for, and it must never become CONFIRMED without a person.
      await prisma.payment.create({
        data: {
          organizationId,
          billId: bill.id,
          amount: total,
          method: "CASH",
          status: "RECORDED",
          recordedByProfileId: actor,
          recordedAt: appointment.scheduledAt,
          notes: "Awaiting confirmation.",
        },
      });
      unpaidCount += 1;
    }
  }
  console.log(
    `  ${billNumber - 1} bills (${paidCount} paid, ${partialCount} part-paid, ${unpaidCount} awaiting confirmation)`,
  );

  // --- Inventory -----------------------------------------------------------
  const stock: Array<[string, string, string, number, number, number]> = [
    ["Nitrile examination gloves", "PPE", "box", 4, 10, 30],
    ["Disposable face masks", "PPE", "box", 18, 10, 40],
    ["Composite filling material", "Restorative", "syringe", 12, 6, 24],
    ["Local anaesthetic cartridges", "Anaesthetic", "box", 2, 5, 15],
    ["Dental burs (assorted)", "Instruments", "pack", 9, 4, 12],
    ["Suction tips", "Consumables", "pack", 22, 8, 30],
    ["Impression material", "Restorative", "kit", 7, 3, 10],
    ["Sterilisation pouches", "Consumables", "box", 14, 6, 20],
  ];

  let lowStock = 0;
  for (const [name, category, unit, quantity, minimum, preferred] of stock) {
    const item = await prisma.inventoryItem.create({
      data: {
        organizationId,
        name,
        category,
        unit,
        sku: name.toUpperCase().replace(/[^A-Z]+/g, "-").slice(0, 20),
        quantityOnHand: quantity,
        minimumQuantity: minimum,
        preferredQuantity: preferred,
      },
    });
    if (quantity < minimum) lowStock += 1;

    // The ledger explains how the count got here: every item opens with a
    // STOCK_IN, then some usage. Quantity is never just asserted.
    await prisma.stockMovement.create({
      data: {
        organizationId,
        itemId: item.id,
        type: "STOCK_IN",
        quantity: preferred,
        balanceAfter: preferred,
        reason: "Opening stock",
        performedByProfileId: actor,
        createdAt: daysFromNow(-60),
      },
    });
    if (preferred > quantity) {
      await prisma.stockMovement.create({
        data: {
          organizationId,
          itemId: item.id,
          type: "STOCK_OUT",
          quantity: preferred - quantity,
          balanceAfter: quantity,
          reason: "Clinical use",
          performedByProfileId: actor,
          createdAt: daysFromNow(-7),
        },
      });
    }
  }
  console.log(`  ${stock.length} inventory items (${lowStock} below minimum)`);

  // --- Follow-ups ----------------------------------------------------------
  let overdue = 0;
  for (let index = 0; index < 12; index += 1) {
    const patient = pick(patients);
    const isOverdue = index < 5;
    const dueDate = daysFromNow(isOverdue ? -3 - index * 2 : 2 + index);
    if (isOverdue) overdue += 1;

    await prisma.followUp.create({
      data: {
        organizationId,
        patientId: patient.id,
        dueDate,
        status: isOverdue ? "OVERDUE" : "PENDING",
        reason: pick([
          "Six-month recall check-up",
          "Review healing after extraction",
          "Crown fitting follow-up",
          "Check response to treatment",
          "Outstanding balance reminder",
        ]),
        assignedToProfileId: actor,
      },
    });
  }
  console.log(`  12 follow-ups (${overdue} overdue)`);

  // --- Patient mail --------------------------------------------------------
  // Drafts only. Nothing is SENT, because nothing has actually been sent: no
  // email provider is configured, and the product never claims delivery it
  // cannot substantiate.
  const upcoming = appointments.filter((a) => a.scheduledAt > new Date()).slice(0, 4);
  for (const [index, appointment] of upcoming.entries()) {
    const patient = patients.find((p) => p.id === appointment.patientId);
    if (!patient) continue;

    await prisma.patientEmail.create({
      data: {
        organizationId,
        patientId: patient.id,
        recipient: patient.email ?? "patient@example.com",
        subject: `Your upcoming appointment at ${organization.name}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          "This is a reminder about your upcoming appointment with us.\n\n" +
          "Please arrive ten minutes early. Reply to this email if you need to " +
          "reschedule.\n\nKind regards,\nBright Smile Dental",
        status: "DRAFT",
        // Alternating, so the UI has both kinds to show.
        generatedByAI: index % 2 === 0,
        relatedAppointmentId: appointment.id,
      },
    });
  }
  console.log(`  ${upcoming.length} draft patient emails`);

  // --- Internal notifications ---------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        organizationId,
        severity: "WARNING",
        title: "Local anaesthetic cartridges below minimum stock",
        body: "2 boxes on hand, minimum is 5.",
        href: "/inventory",
        entityType: "InventoryItem",
      },
      {
        organizationId,
        severity: "WARNING",
        title: `${overdue} follow-ups are overdue`,
        href: "/followups",
      },
      {
        organizationId,
        severity: "INFO",
        title: `${unpaidCount} payments are awaiting your confirmation`,
        href: "/billing",
      },
    ],
  });
  console.log("  3 notifications");

  // --- Audit trail ---------------------------------------------------------
  // A handful of entries so the Activity screen is not empty on first load.
  // Real entries are written by runCommand; these are backfill for the demo.
  await prisma.auditLog.createMany({
    data: completed.slice(0, 8).map((appointment) => ({
      organizationId,
      actorType: "USER" as const,
      actorProfileId: actor,
      action: "appointment.close",
      entityType: "Appointment",
      entityId: appointment.id,
      commandId: randomUUID(),
      createdAt: appointment.closedAt ?? new Date(),
    })),
  });

  await prisma.$disconnect();

  console.log(
    `\nDone. Sign in as ${authUser.email} to see "Bright Smile Dental".\n` +
      "Re-run this command at any time; it recreates the demo clinic and leaves\n" +
      "every other organization untouched.",
  );
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
