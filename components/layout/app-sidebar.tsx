import { NavLinks } from "@/components/layout/nav-links";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * The desktop sidebar: the one large navy surface that anchors the layout.
 *
 * Fixed width, hidden below `lg` — the mobile drawer in `mobile-nav.tsx` takes
 * over there. Server Component: it renders no state of its own, only the
 * organization name passed down from the layout's single session read.
 */
export function AppSidebar({
  organizationName,
}: {
  organizationName: string;
}) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col border-r border-sidebar-border lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <Logo className="text-sidebar-foreground [&_span]:text-sidebar-foreground" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <p className="truncate px-3 pb-2 text-xs text-sidebar-foreground/60">
          {organizationName}
        </p>
        <SignOutButton
          variant="ghost"
          className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start"
        />
      </div>
    </aside>
  );
}
