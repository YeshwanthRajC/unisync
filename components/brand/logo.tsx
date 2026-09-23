import { cn } from "@/lib/utils";

/**
 * The UniSync mark: two offset rounded bars converging on a dot.
 *
 * It reads as separate things being brought into line, which is what the product
 * does — several strands of admin work pulled into one place. Drawn as inline SVG
 * with `currentColor` so it inherits its surroundings and needs no second asset
 * for the navy sidebar versus the white auth card.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <path
        d="M7 9.5h11a6.5 6.5 0 0 1 0 13H7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M25 9.5h-4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="25" cy="22.5" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** Mark plus wordmark, for headers and the auth pages. */
export function Logo({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="text-primary" />
      <div className="leading-none">
        <span className="font-heading text-[1.0625rem] font-semibold tracking-tight">
          UniSync
        </span>
        {showTagline ? (
          <p className="text-muted-foreground mt-1 text-xs">
            One platform. Every operation.
          </p>
        ) : null}
      </div>
    </div>
  );
}
