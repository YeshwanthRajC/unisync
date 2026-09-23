import type { AppPrisma } from "@/lib/db/prisma";

/**
 * The transaction client type, DERIVED from the extended client.
 *
 * It is deliberately not `Prisma.TransactionClient`. That alias describes the
 * *unextended* client, and `$extends` changes the type: the callback Prisma hands
 * our extended client's `$transaction` is not assignable to it. Deriving the type
 * from the real `$transaction` signature means it stays correct if another
 * extension is added later.
 *
 * `Parameters<>` on an overloaded function resolves to the last overload, which
 * is the callback form `<R>(fn: (client) => Promise<R>) => Promise<R>`.
 */
type TransactionArg = Parameters<AppPrisma["$transaction"]>[0];

export type TxClient = TransactionArg extends (client: infer C) => unknown
  ? C
  : never;

/**
 * A database handle a service can READ through.
 *
 * Reads accept either the root client or a transaction client, so the same query
 * function works standalone and inside a command's transaction. Writes take a
 * `UnitOfWork` instead (see `lib/server/unit.ts`) — they must not be able to run
 * outside a transaction at all.
 */
export type Db = AppPrisma | TxClient;
