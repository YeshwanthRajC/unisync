import type { LucideIcon } from "lucide-react";
import { CalendarDaysIcon, HomeIcon, UsersIcon } from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";

/**
 * The sidebar's link list.
 *
 * A single source of truth shared by the desktop sidebar and the mobile drawer,
 * so the two can never drift. `permission` gates visibility — a STAFF member
 * never sees a link to a page `loadContext` would immediately redirect them out
 * of.
 *
 * Grows by one entry per module as it ships. A module with no entry here yet is
 * not reachable from the shell, which is deliberate: a nav link to an
 * unbuilt page is exactly the half-finished state this file exists to avoid.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/home", label: "Home", icon: HomeIcon, permission: "organization.read" },
  { href: "/patients", label: "Patients", icon: UsersIcon, permission: "patient.read" },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarDaysIcon,
    permission: "appointment.read",
  },
];
