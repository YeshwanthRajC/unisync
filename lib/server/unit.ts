import "server-only";

import type { ActorType } from "@/lib/db/generated/enums";

import { toJsonObject } from "@/lib/db/json";
import { prisma } from "@/lib/db/prisma";
import type { TxClient } from "@/lib/db/types";
import type { OrganizationContext } from "@/lib/auth/session";

/**
 * The command envelope: one transaction, one audit record.
 *
 * Every write in this application runs through `runCommand`. Two properties fall
 * out of that, and both are the reason it exists rather than being a convenience:
 *
 *  1. AUDIT-ONCE IS A PROPERTY OF THE TRANSACTION. The audit row is written
 *     inside the same transaction as the change it describes, so they commit or
 *     roll back together. There is no window in which a patient exists and no
 *     record of who created them does.
 *
 *  2. SERVICE AUTHORS CANNOT FORGET TO AUDIT, because it was never their job.
 *     A command body never imports the audit module. Composed commands — a
 *     billing command that consumes stock — receive the SAME unit and contribute
 *     detail through `note()`, so one user action produces one audit record
 *     rather than three unrelated-looking ones.
 *
 * The alternative considered and rejected was auto-auditing via a Prisma
 * `$allOperations` extension. It sees `patient.update`, not
 * `appointment.cancel`: it cannot know intent, it fires once per row so a
 * 30-row write produces 30 records, and it cannot distinguish a meaningful
 * change from internal bookkeeping.
 *
 * Actor attribution lives in the envelope rather than in `OrganizationContext`,
 * because the service is genuinely identical whether a human or the AI agent
 * drove it — only the invocation channel differs. That is why adding the agent
 * required no change to `lib/auth/session.ts`.
 */

/** A supplementary audit record for a genuinely distinct second action. */
export type AuditEntry = {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export type UnitOfWork = {
  /** The transaction client. Every write in the body must use this. */
  readonly db: TxClient;
  /** Merge structured, non-sensitive detail into this unit's audit record. */
  note(patch: Record<string, unknown>): void;
  /** Name the primary entity the action targeted. */
  target(entityType: string, entityId: string): void;
  /** Escape hatch: record a second, genuinely separate action. */
  alsoAudit(entry: AuditEntry): void;
};

export type CommandEnvelope = {
  ctx: OrganizationContext;
  /** Dot-namespaced verb written to AuditLog, e.g. "appointment.cancel". */
  action: string;
  actor: { type: ActorType; aiToolName?: string };
  entityType?: string;
};

/**
 * Run a write as a single audited transaction.
 *
 * Called from exactly two places: the Server Action wrapper
 * (`lib/server/action.ts`) and the AI tool runner. Both supply their own
 * `actor`, which is what makes the audit trail able to distinguish
 * "the receptionist cancelled this" from "the agent cancelled this".
 */
export async function runCommand<T>(
  envelope: CommandEnvelope,
  body: (unit: UnitOfWork) => Promise<T>,
): Promise<T> {
  const { ctx, action, actor } = envelope;

  return prisma.$transaction(async (tx) => {
    let entityType = envelope.entityType;
    let entityId: string | undefined;
    const metadata: Record<string, unknown> = {};
    const extraEntries: AuditEntry[] = [];

    const unit: UnitOfWork = {
      db: tx,
      note(patch) {
        Object.assign(metadata, patch);
      },
      target(type, id) {
        entityType = type;
        entityId = id;
      },
      alsoAudit(entry) {
        extraEntries.push(entry);
      },
    };

    const result = await body(unit);

    // Written last, inside the same transaction, so the record can describe what
    // actually happened rather than what was about to be attempted.
    await tx.auditLog.createMany({
      data: [
        {
          organizationId: ctx.organizationId,
          actorType: actor.type,
          actorProfileId: actor.type === "SYSTEM" ? null : ctx.profileId,
          action,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          // `metadata` is `Json?`: omit rather than write an empty object, so
          // "no detail recorded" and "detail was an empty object" stay distinct.
          metadata: toJsonObject(metadata),
          aiToolName: actor.aiToolName ?? null,
        },
        ...extraEntries.map((entry) => ({
          organizationId: ctx.organizationId,
          actorType: actor.type,
          actorProfileId: actor.type === "SYSTEM" ? null : ctx.profileId,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata ? toJsonObject(entry.metadata) : undefined,
          aiToolName: actor.aiToolName ?? null,
        })),
      ],
    });

    return result;
  });
}
