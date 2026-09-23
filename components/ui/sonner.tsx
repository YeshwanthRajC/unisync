"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host.
 *
 * Edited from the shadcn default, which read the active theme from
 * `next-themes`. UniSync ships light-first with no theme switcher, so that
 * dependency existed only to answer a question with one possible answer — while
 * wrapping the entire tree in a client provider and injecting a `<script>` that
 * React 19 warns about on every render.
 *
 * The theme is a prop with a sensible default instead. Dark mode remains fully
 * available: the `.dark` token block and the `dark` variant are intact in
 * `globals.css`, so enabling it later means putting the class on `<html>` and
 * passing `theme="dark"` here.
 */
const Toaster = ({ theme = "light", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
