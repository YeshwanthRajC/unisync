"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Applies the theme class to <html>.
 *
 * Without this, nothing ever set the `.dark` class, so the complete `.dark` token
 * block in `globals.css` was unreachable and `useTheme()` — which
 * `components/ui/sonner.tsx` calls to pick toast colours — always returned the
 * default regardless of the real theme.
 *
 * UniSync's visual language is light-first, so light is the default and the
 * system preference is not followed automatically. The dark tokens are kept
 * coherent so the theme can be offered later without a redesign.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
