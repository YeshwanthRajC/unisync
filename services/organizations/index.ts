/**
 * Public surface of the organizations module.
 *
 * Other modules import from here, never from `commands`/`queries` directly, so
 * the set of operations a module exposes stays visible in one file.
 */
export {
  createOrganizationForUser,
  revertOnboardingForUser,
  updateOrganization,
} from "@/services/organizations/commands";
export {
  getCurrentOrganization,
  isSlugAvailable,
  userHasOrganization,
} from "@/services/organizations/queries";
export {
  CURRENCIES,
  TIMEZONES,
  createOrganizationSchema,
  slugify,
  slugSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@/services/organizations/schema";
