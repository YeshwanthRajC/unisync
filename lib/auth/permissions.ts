import { MembershipRole } from "@/lib/db/generated/enums";

/**
 * The permission vocabulary.
 *
 * Roles are coarse and stored on the Membership row; permissions are fine and
 * derived from the role at request time. Code always asks "may this actor do
 * X?", never "is this actor an ADMIN?", so adding a role later does not mean
 * hunting down scattered role comparisons.
 *
 * Only platform-level permissions exist today. Each business module will add
 * its own entries here as it is built (e.g. "patient.read", "billing.refund").
 */
export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "member.read",
  "member.invite",
  "member.update_role",
  "member.remove",
  "audit.read",
  "ai.use",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_PERMISSIONS: readonly Permission[] = PERMISSIONS;

const ADMIN_PERMISSIONS: readonly Permission[] = [
  "organization.read",
  "organization.update",
  "member.read",
  "member.invite",
  "audit.read",
  "ai.use",
];

const STAFF_PERMISSIONS: readonly Permission[] = [
  "organization.read",
  "member.read",
  "ai.use",
];

const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  [MembershipRole.OWNER]: OWNER_PERMISSIONS,
  [MembershipRole.ADMIN]: ADMIN_PERMISSIONS,
  [MembershipRole.STAFF]: STAFF_PERMISSIONS,
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
