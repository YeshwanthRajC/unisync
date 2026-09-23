import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";

const WITH_ITEMS = { include: { items: { orderBy: { position: "asc" as const } } } };

export async function listPrescriptionsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.prescription.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { issuedAt: "desc" },
    ...WITH_ITEMS,
  });
}

export async function getPrescriptionOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const prescription = await db.prescription.findFirst({
    where: orgWhere(ctx, { id }),
    ...WITH_ITEMS,
  });

  if (!prescription) throw new NotFoundError("prescription");
  return prescription;
}
