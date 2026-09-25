"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/server/action";
import {
  updateOrganization,
  updateOrganizationSchema,
} from "@/services/organizations";

const updateOrgCommand = action({
  audit: "organization.update",
  permission: "organization.update",
  schema: updateOrganizationSchema,
  entityType: "Organization",
  revalidate: () => ["/settings", "/home"],
  run: ({ input, ctx, unit }) => updateOrganization(ctx, input, unit),
});

export async function updateOrganizationAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await updateOrgCommand(Object.fromEntries(formData.entries()));
  if (result.ok) {
    revalidatePath("/settings");
    revalidatePath("/home");
  }
  return result;
}
