import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";

/**
 * Proof that a human being deliberately asked for this.
 *
 * Three actions in this product must never happen as a side effect, on a
 * schedule, or because a language model suggested them:
 *
 *   - closing an appointment
 *   - confirming that a payment was received
 *   - sending an email to a patient
 *
 * Those services require a `HumanIntent` as a REQUIRED positional argument. The
 * type is branded with a `unique symbol`, so it cannot be produced by an object
 * literal, a cast from JSON, or anything the AI layer can construct — the only
 * way to obtain one is `mintHumanIntent`, and `lib/ai/**` is forbidden by an
 * ESLint boundary from importing this module.
 *
 * The consequence that matters: an AI tool that tries to close an appointment
 * does not fail a runtime permission check that someone might later refactor
 * away. It fails `tsc`. The guarantee is carried by the type system, which means
 * it is checked on every build rather than on the code paths a test happened to
 * cover.
 *
 * This is one of four independent layers. The others are the database CHECK
 * constraints (an appointment cannot be COMPLETED without a closer, even via raw
 * SQL), the absence of any service that changes these states as a side effect,
 * and HUMAN_ONLY_PERMISSIONS in lib/auth/permissions.ts.
 */

declare const humanIntentBrand: unique symbol;

export type HumanIntent = {
  readonly [humanIntentBrand]: "human";
  /** The person who asked. Written to `closedBy` / `confirmedBy` / `sentBy`. */
  readonly profileId: string;
  readonly at: Date;
};

/**
 * Mint proof of human intent from a verified session context.
 *
 * ONLY `lib/server/action.ts` may call this. It is reachable exclusively from a
 * Server Action, whose caller is by definition a cookie-authenticated browser
 * request made by a person.
 */
export function mintHumanIntent(context: OrganizationContext): HumanIntent {
  return {
    profileId: context.profileId,
    at: new Date(),
  } as HumanIntent;
}
