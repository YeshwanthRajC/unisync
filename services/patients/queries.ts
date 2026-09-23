import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/db/generated/client";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import type { PatientFilter } from "@/services/patients/schema";

function filterWhere(
  ctx: OrganizationContext,
  filter: PatientFilter,
): Prisma.PatientWhereInput {
  const base = orgWhere(ctx, {});

  const status =
    filter.status === "ALL"
      ? {}
      : { isActive: filter.status === "ACTIVE" };

  if (!filter.search) return { ...base, ...status };

  return {
    ...base,
    ...status,
    OR: [
      { fullName: { contains: filter.search, mode: "insensitive" } },
      { phone: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
    ],
  };
}

export async function listPatients(
  ctx: OrganizationContext,
  filter: PatientFilter,
  db: Db = prisma,
) {
  return db.patient.findMany({
    where: filterWhere(ctx, filter),
    orderBy: { fullName: "asc" },
  });
}

export async function getPatientOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const patient = await db.patient.findFirst({
    where: orgWhere(ctx, { id }),
  });

  if (!patient) throw new NotFoundError("patient");
  return patient;
}

/** For Organization Pulse: how many active patients this clinic has. */
export async function countActivePatients(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  return db.patient.count({
    where: orgWhere(ctx, { isActive: true }),
  });
}

/** Recently added patients, for the Pulse dashboard. */
export async function listRecentPatients(
  ctx: OrganizationContext,
  take: number,
  db: Db = prisma,
) {
  return db.patient.findMany({
    where: orgWhere(ctx, { isActive: true }),
    orderBy: { createdAt: "desc" },
    take,
  });
}
