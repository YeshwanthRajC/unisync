import { describe, expect, it } from "vitest";

import { MembershipRole } from "@/lib/db/generated/enums";
import {
  HUMAN_ONLY_PERMISSIONS,
  PERMISSIONS,
  aiHasPermission,
  effectiveAiPermissions,
  permissionsForRole,
  roleHasPermission,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * The permission matrix is security-critical and entirely declarative, which
 * makes it exactly the kind of thing that rots silently: a careless paste adds a
 * permission to the wrong block and nothing fails until someone deletes a patient
 * they should not have been able to see.
 */

const ROLES = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.STAFF,
] as const;

describe("permission vocabulary", () => {
  it("has no duplicate entries", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("grants every declared permission to at least one role", () => {
    // Catches a permission that was declared, referenced by a service, and then
    // never placed in a grant block — which would make the feature unreachable
    // for every role including OWNER.
    const orphaned = PERMISSIONS.filter(
      (permission) => !ROLES.some((role) => roleHasPermission(role, permission)),
    );
    expect(orphaned).toEqual([]);
  });

  it("gives OWNER every permission", () => {
    const ownerPermissions = new Set(permissionsForRole(MembershipRole.OWNER));
    const missing = PERMISSIONS.filter((p) => !ownerPermissions.has(p));
    expect(missing).toEqual([]);
  });

  it("never grants a role a permission outside the vocabulary", () => {
    const vocabulary = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of permissionsForRole(role)) {
        expect(vocabulary.has(permission)).toBe(true);
      }
    }
  });

  it("keeps irreversible actions away from ADMIN and STAFF", () => {
    // Deleting a patient, voiding a bill and refunding money are owner-only by
    // design. This is the assertion that fails if someone widens a grant block.
    const irreversible: Permission[] = [
      "patient.delete",
      "bill.void",
      "payment.refund",
      "member.remove",
      "member.update_role",
    ];

    for (const permission of irreversible) {
      expect(roleHasPermission(MembershipRole.OWNER, permission)).toBe(true);
      expect(roleHasPermission(MembershipRole.ADMIN, permission)).toBe(false);
      expect(roleHasPermission(MembershipRole.STAFF, permission)).toBe(false);
    }
  });

  it("gives STAFF no organization-administration powers", () => {
    for (const permission of [
      "organization.update",
      "member.invite",
      "audit.read",
    ] as Permission[]) {
      expect(roleHasPermission(MembershipRole.STAFF, permission)).toBe(false);
    }
  });
});

describe("human-only permissions", () => {
  it("declares only permissions that exist", () => {
    const vocabulary = new Set<string>(PERMISSIONS);
    for (const permission of HUMAN_ONLY_PERMISSIONS) {
      expect(vocabulary.has(permission)).toBe(true);
    }
  });

  it("covers the three product-mandated manual gates", () => {
    // The product rule: closing an appointment, confirming a payment and sending
    // a patient email are decisions a person makes. If any of these ever leaves
    // this set, the AI could be handed a tool for it.
    expect(HUMAN_ONLY_PERMISSIONS.has("appointment.close")).toBe(true);
    expect(HUMAN_ONLY_PERMISSIONS.has("payment.confirm")).toBe(true);
    expect(HUMAN_ONLY_PERMISSIONS.has("patient_email.send")).toBe(true);
  });

  it("withholds every human-only permission from the AI, for every role", () => {
    for (const role of ROLES) {
      const aiPermissions = new Set(effectiveAiPermissions(role));
      for (const permission of HUMAN_ONLY_PERMISSIONS) {
        expect(aiPermissions.has(permission)).toBe(false);
        expect(aiHasPermission(role, permission)).toBe(false);
      }
    }
  });

  it("withholds them even from OWNER, who holds every human permission", () => {
    // The distinction that matters: the OWNER *may* close an appointment; the
    // agent acting on the OWNER's behalf may not. Permission to act is not
    // transferable to the model.
    expect(roleHasPermission(MembershipRole.OWNER, "appointment.close")).toBe(
      true,
    );
    expect(aiHasPermission(MembershipRole.OWNER, "appointment.close")).toBe(
      false,
    );
  });

  it("still lets the AI do ordinary work", () => {
    // A guard against over-correcting: the gates must not leave the agent inert.
    const ai = new Set(effectiveAiPermissions(MembershipRole.OWNER));
    for (const permission of [
      "patient.read",
      "patient.create",
      "appointment.create",
      "appointment.read",
      "bill.create",
      "inventory.movement",
      "followup.create",
      "patient_email.draft",
      "ai.use",
    ] as Permission[]) {
      expect(ai.has(permission)).toBe(true);
    }
  });

  it("lets the AI draft an email but never send one", () => {
    const ai = new Set(effectiveAiPermissions(MembershipRole.OWNER));
    expect(ai.has("patient_email.draft")).toBe(true);
    expect(ai.has("patient_email.send")).toBe(false);
  });
});
