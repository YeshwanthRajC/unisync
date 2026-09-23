"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The top bar shown below `lg`, where the fixed sidebar in `app-sidebar.tsx`
 * is hidden. Its drawer reuses the same `NavLinks` list, so the two surfaces
 * can never show different links.
 */
export function MobileNav({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-sidebar text-sidebar-foreground flex h-14 items-center justify-between border-b border-sidebar-border px-4 lg:hidden">
      <Logo className="text-sidebar-foreground [&_span]:text-sidebar-foreground" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <MenuIcon aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-sidebar text-sidebar-foreground flex w-72 flex-col p-0">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle className="text-sidebar-foreground">
              {organizationName}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>

          <div className="border-t border-sidebar-border px-3 py-3">
            <SignOutButton
              variant="ghost"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start"
            />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
