import { z } from "zod";

/**
 * Input schemas for the organization module.
 *
 * No `server-only` guard: Client Components import these to validate a form
 * before submitting, so the same rules run in both places and the user does not
 * have to round-trip to learn that a field is required.
 */

/** IANA zone names we offer. Kept short and India-first; extend as needed. */
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;

/**
 * A URL-safe identifier for the organization.
 *
 * Lowercase, hyphen-separated, no leading or trailing hyphen. Constrained here
 * rather than sanitised silently, so a user who types something odd is told,
 * instead of finding the system renamed their clinic.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters.")
  .max(48, "Use at most 48 characters.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the organization's name.")
    .max(120, "That name is too long."),
  slug: slugSchema,
  type: z.enum(["DENTAL_CLINIC", "OTHER"]),
  timezone: z.enum(TIMEZONES),
  currency: z.enum(CURRENCIES),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  timezone: z.enum(TIMEZONES),
  currency: z.enum(CURRENCIES),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/** Turn a display name into a candidate slug, for prefilling the field. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
