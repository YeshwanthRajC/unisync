import { MembershipRole } from "@/lib/db/generated/enums";

/**
 * The permission vocabulary.
 *
 * Code asks "may this actor do X?", never "is this actor an ADMIN?", so adding
 * a role later does not mean hunting down scattered role comparisons.
 *
 * Two properties this file is responsible for:
 *
 *  1. The role -> permission matrix is assembled from per-module GRANT blocks
 *     rather than three hand-maintained flat arrays. At ~50 permissions the flat
 *     form stops being reviewable: you cannot tell by reading it whether STAFF
 *     was given `payment.refund` deliberately or by a careless paste.
 *
 *  2. Some permissions are marked HUMAN-ONLY. Those are never granted to the AI
 *     agent regardless of the calling user's role, because the product rule is
 *     that closing an appointment, confirming a payment and sending a patient
 *     email are decisions a person makes. This set is the *fourth* layer of that
 *     guarantee — see lib/auth/human-intent.ts for the layer that makes a
 *     violation fail typechecking rather than a runtime check.
 */

export const PERMISSIONS = [
  // Organization & membership
  "organization.read",
  "organization.update",
  "member.read",
  "member.invite",
  "member.update_role",
  "member.remove",
  "audit.read",

  // Patients
  "patient.read",
  "patient.create",
  "patient.update",
  "patient.delete",

  // Appointments
  "appointment.read",
  "appointment.create",
  "appointment.update",
  "appointment.cancel",
  "appointment.close",

  // Consultations & prescriptions
  "consultation.read",
  "consultation.create",
  "consultation.update",
  "prescription.read",
  "prescription.create",

  // Billing
  "bill.read",
  "bill.create",
  "bill.void",
  "payment.read",
  "payment.record",
  "payment.confirm",
  "payment.refund",

  // Inventory
  "inventory.read",
  "inventory.create",
  "inventory.update",
  "inventory.movement",

  // Follow-ups
  "followup.read",
  "followup.create",
  "followup.update",
  "followup.complete",

  // Patient mail
  "patient_email.read",
  "patient_email.draft",
  "patient_email.send",

  // Internal notifications & reporting
  "notification.read",
  "notification.update",
  "report.read",

  // AI assistant
  "ai.use",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissions the AI agent may NEVER hold, whatever the calling user's role.
 *
 * These are the actions the product requires a human to take deliberately:
 * closing an appointment, confirming that money arrived, sending a message to a
 * patient, and the irreversible ones (deleting a patient, voiding a bill,
 * issuing a refund).
 *
 * `lib/ai/tools/index.ts` throws at registry construction if any tool claims one
 * of these, and the agent loop re-applies the set on every call. Omitting the
 * tool is the real control; this set is what makes a future contributor's
 * well-meaning addition fail the build with an explanation.
 */
export const HUMAN_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "appointment.close",
  "payment.confirm",
  "payment.refund",
  "patient_email.send",
  "patient.delete",
  "bill.void",
]);

// ---------------------------------------------------------------------------
// Role assembly
// ---------------------------------------------------------------------------

/**
 * Read-only access to a module. Granted to every role, because a receptionist
 * who cannot see a bill cannot answer the phone.
 */
const READ_GRANTS: readonly Permission[] = [
  "organization.read",
  "member.read",
  "patient.read",
  "appointment.read",
  "consultation.read",
  "prescription.read",
  "bill.read",
  "payment.read",
  "inventory.read",
  "followup.read",
  "patient_email.read",
  "notification.read",
];

/** Day-to-day operational work: the things a shift consists of. */
const OPERATIONAL_GRANTS: readonly Permission[] = [
  "patient.create",
  "patient.update",
  "appointment.create",
  "appointment.update",
  "appointment.cancel",
  "appointment.close",
  "consultation.create",
  "consultation.update",
  "prescription.create",
  "bill.create",
  "payment.record",
  "payment.confirm",
  "inventory.movement",
  "followup.create",
  "followup.update",
  "followup.complete",
  "patient_email.draft",
  "patient_email.send",
  "notification.update",
  "ai.use",
];

/** Administration of the organization itself, plus reporting. */
const ADMINISTRATIVE_GRANTS: readonly Permission[] = [
  "organization.update",
  "member.invite",
  "audit.read",
  "report.read",
  "inventory.create",
  "inventory.update",
];

/** Irreversible or financially sensitive. Owner only. */
const PRIVILEGED_GRANTS: readonly Permission[] = [
  "member.update_role",
  "member.remove",
  "patient.delete",
  "bill.void",
  "payment.refund",
];

function grant(...blocks: readonly Permission[][]): readonly Permission[] {
  return Array.from(new Set(blocks.flat()));
}

const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  /*
   * The single administrator the product is designed around: every block.
   *
   * Spelled out rather than aliased to PERMISSIONS. Aliasing would auto-grant
   * every future permission to OWNER, so adding a dangerous one would hand it
   * over silently. Assembling from blocks forces the author of a new permission
   * to place it deliberately — and if they forget, OWNER visibly lacks it
   * instead of invisibly gaining it. `tests/permissions.test.ts` asserts no
   * permission is orphaned outside every block.
   */
  [MembershipRole.OWNER]: grant(
    [...READ_GRANTS],
    [...OPERATIONAL_GRANTS],
    [...ADMINISTRATIVE_GRANTS],
    [...PRIVILEGED_GRANTS],
  ),
  [MembershipRole.ADMIN]: grant(
    [...READ_GRANTS],
    [...OPERATIONAL_GRANTS],
    [...ADMINISTRATIVE_GRANTS],
  ),
  [MembershipRole.STAFF]: grant([...READ_GRANTS], [...OPERATIONAL_GRANTS]),
};

export function permissionsForRole(role: MembershipRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(
  role: MembershipRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * What the AI agent may do on behalf of a caller with this role: their
 * permissions minus everything a human must do personally.
 *
 * Used both to build the tool list the model is shown and to re-check each
 * call. Filtering the list is usability; the re-check is the enforcement.
 */
export function effectiveAiPermissions(
  role: MembershipRole,
): readonly Permission[] {
  return ROLE_PERMISSIONS[role].filter(
    (permission) => !HUMAN_ONLY_PERMISSIONS.has(permission),
  );
}

export function aiHasPermission(
  role: MembershipRole,
  permission: Permission,
): boolean {
  return (
    !HUMAN_ONLY_PERMISSIONS.has(permission) &&
    roleHasPermission(role, permission)
  );
}
