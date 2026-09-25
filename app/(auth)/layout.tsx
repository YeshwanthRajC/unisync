import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import {
  StartingAnimationOverlay,
  ReplayIntroButton,
} from "@/components/brand/starting-animation";

/**
 * Layout for the unauthenticated routes.
 *
 * A two-column split on large screens: the form on the left at a comfortable
 * reading width, and a navy panel on the right carrying the product's promise.
 * On smaller screens the panel drops away entirely rather than stacking — a
 * marketing panel above a sign-in form just pushes the form below the fold.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <StartingAnimationOverlay />
      <div className="flex min-h-svh flex-1 flex-col lg:grid lg:grid-cols-[1fr_minmax(0,28rem)]">
        <div className="flex flex-1 flex-col px-6 py-8 sm:px-10">
          <header>
            <Link
              href="/"
              className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Logo />
            </Link>
          </header>

          <main className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-sm">{children}</div>
          </main>

          <footer className="text-muted-foreground text-xs flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} UniSync</span>
            <ReplayIntroButton />
          </footer>
        </div>

      {/* Decorative: hidden from assistive tech and from small screens. */}
      <aside
        aria-hidden="true"
        className="bg-sidebar text-sidebar-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end"
      >
        {/* A single soft radial lift, not a gradient wash: it gives the panel
            depth without the sheen that reads as a template. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 80% at 85% 0%, color-mix(in oklab, var(--sidebar-primary) 38%, transparent), transparent 60%)",
          }}
        />
        <div className="relative space-y-6 p-12">
          <p className="font-heading text-2xl leading-snug font-medium text-white">
            One platform.
            <br />
            Every operation.
          </p>
          <p className="max-w-xs text-sm leading-relaxed opacity-80">
            Patients, appointments, billing, inventory and follow-ups in one
            place — with an assistant that prepares the work and leaves the
            decisions to you.
          </p>
          <div className="flex gap-1.5 pt-2">
            <span className="bg-sidebar-primary h-1 w-10 rounded-full" />
            <span className="h-1 w-5 rounded-full bg-white/25" />
            <span className="h-1 w-5 rounded-full bg-white/25" />
          </div>
        </div>
      </aside>
    </div>
  </>
  );
}


