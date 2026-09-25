"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type AnimationStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StartingAnimationProps {
  /** Callback fired when the animation finishes its exit transition or is skipped */
  onComplete?: () => void;
  /** Whether the animation should auto-play on mount (default: true) */
  autoPlay?: boolean;
  /** If provided, locks the component to a specific step (useful for storyboard preview) */
  fixedStep?: AnimationStep;
  /** Custom class for the wrapper container */
  className?: string;
  /** If true, renders inline without full-screen fixed positioning */
  inline?: boolean;
  /** Total animation duration in milliseconds (default: 3200) */
  duration?: number;
  /** Allow clicking anywhere to skip (default: true) */
  clickToSkip?: boolean;
  /** Show the top-right skip button (default: true) */
  showSkipButton?: boolean;
  /** Optional step label below the loader (default: false, set to true for preview/storyboard) */
  showStepIndicator?: boolean;
}

/**
 * Animated UniSync Logo Mark
 * Renders the authentic UniSync mark:
 * - Hairpin loop path: M7 9.5h11a6.5 6.5 0 0 1 0 13H7
 * - Top offset bar: M25 9.5h-4
 * - Convergence dot: circle cx="25" cy="22.5" r="2.25"
 *
 * Each element interpolates across Steps 1 -> 3 according to the storyboard spec:
 * Step 1: Strokes appear and begin tracing inwards
 * Step 2: Main loop curves around, top bar converges, dot scales in
 * Step 3: All strokes snap complete, unified with a subtle radiant glow
 */
export function AnimatedUniSyncMark({
  step,
  progress = 0,
  className,
}: {
  step: AnimationStep;
  progress?: number;
  className?: string;
}) {
  // Main hairpin path math:
  // Stroke starts at (7, 9.5) -> (18, 9.5) -> arc r=6.5 to (18, 22.5) -> (7, 22.5)
  // Total length is ~42.42 units. Using pathLength="100" makes strokeDashoffset percentage-based.
  let hairpinOffset = 0;
  let hairpinOpacity = 1;
  let topBarOffset = 0;
  let topBarOpacity = 0.45;
  let dotScale = 1;
  let dotOpacity = 1;
  let hairpinDrift = "translate(0px, 0px)";
  let topBarDrift = "translate(0px, 0px)";

  if (step === 1) {
    // Step 1: Strokes appear & start tracing
    hairpinOffset = 62; // Only first ~38% drawn (top entrance)
    hairpinOpacity = 0.85;
    hairpinDrift = "translate(-3px, -1px)";

    topBarOffset = 65; // Upper bar beginning to enter
    topBarOpacity = 0.3;
    topBarDrift = "translate(3px, 0px)";

    dotScale = 0;
    dotOpacity = 0;
  } else if (step === 2) {
    // Step 2: Logo forms - hairpin loops around curve, top bar completes, dot emerges
    hairpinOffset = 18; // Around the curve, entering bottom return
    hairpinOpacity = 0.95;
    hairpinDrift = "translate(-1px, 0px)";

    topBarOffset = 0; // Fully drawn
    topBarOpacity = 0.4;
    topBarDrift = "translate(0px, 0px)";

    dotScale = 0.65;
    dotOpacity = 0.7;
  } else {
    // Step 3 to 6: Completed logo mark
    hairpinOffset = 0;
    hairpinOpacity = 1;
    hairpinDrift = "translate(0px, 0px)";

    topBarOffset = 0;
    topBarOpacity = 0.45;
    topBarDrift = "translate(0px, 0px)";

    dotScale = 1;
    dotOpacity = 1;
  }

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Ambient glow behind mark when completed */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-4 rounded-full transition-all duration-700 ease-out",
          step >= 3
            ? "opacity-100 scale-100 bg-radial from-blue-500/10 via-primary/5 to-transparent blur-xl"
            : "opacity-0 scale-75"
        )}
      />

      <svg
        viewBox="0 0 32 32"
        fill="none"
        aria-label="UniSync Logo"
        className="size-20 sm:size-24 text-primary relative z-10 drop-shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
      >
        <defs>
          {/* Subtle gradient matching UniSync deep navy to vibrant blue accent */}
          <linearGradient id="unisync-stroke-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.2549 0.0313 260.42)" />
            <stop offset="100%" stopColor="oklch(0.4727 0.0927 248.27)" />
          </linearGradient>
          <linearGradient id="unisync-dot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.3462 0.0736 256.04)" />
            <stop offset="100%" stopColor="oklch(0.4727 0.0927 248.27)" />
          </linearGradient>
        </defs>

        {/* Main hairpin path */}
        <path
          d="M7 9.5h11a6.5 6.5 0 0 1 0 13H7"
          stroke="url(#unisync-stroke-grad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={hairpinOffset}
          style={{
            transform: hairpinDrift,
            opacity: hairpinOpacity,
            transition:
              "stroke-dashoffset 650ms cubic-bezier(0.16, 1, 0.3, 1), transform 650ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease",
          }}
        />

        {/* Top offset segment */}
        <path
          d="M25 9.5h-4"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={topBarOffset}
          style={{
            transform: topBarDrift,
            opacity: topBarOpacity,
            transition:
              "stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease",
          }}
        />

        {/* Convergence dot */}
        <circle
          cx="25"
          cy="22.5"
          r="2.25"
          fill="url(#unisync-dot-grad)"
          style={{
            transformOrigin: "25px 22.5px",
            transform: `scale(${dotScale})`,
            opacity: dotOpacity,
            transition:
              "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 400ms ease",
          }}
        />
      </svg>
    </div>
  );
}

/**
 * Full Starting Animation Component
 * Executes the 6-phase sequence from the storyboard:
 * 01 — Logo strokes appear
 * 02 — Logo forms
 * 03 — Logo completes
 * 04 — Wordmark appears
 * 05 — Tagline and loader appear
 * 06 — Loader completes
 */
export function StartingAnimation({
  onComplete,
  autoPlay = true,
  fixedStep,
  className,
  inline = false,
  duration = 3200,
  clickToSkip = true,
  showSkipButton = true,
  showStepIndicator = false,
}: StartingAnimationProps) {
  const [step, setStep] = useState<AnimationStep>(fixedStep || 1);
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // If a fixed step is passed (e.g. storyboard cards), lock to that step
  useEffect(() => {
    if (fixedStep) {
      setStep(fixedStep);
      if (fixedStep <= 4) {
        setLoaderProgress(0);
      } else if (fixedStep === 5) {
        setLoaderProgress(38);
      } else if (fixedStep === 6) {
        setLoaderProgress(100);
      }
    }
  }, [fixedStep]);

  // Finish / dismiss animation
  const handleFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsExiting(true);

    setTimeout(() => {
      setIsUnmounted(true);
      onComplete?.();
    }, 450);
  }, [onComplete]);

  // Keyboard shortcut: Escape or Space to skip
  useEffect(() => {
    if (inline || fixedStep) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFinish, inline, fixedStep]);

  // Main animation timer loop
  useEffect(() => {
    if (!autoPlay || fixedStep) return;

    // Check prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(6);
      setLoaderProgress(100);
      const timer = setTimeout(handleFinish, 300);
      return () => clearTimeout(timer);
    }

    const tStep1End = duration * 0.18; // 0 - 18%: Logo strokes appear
    const tStep2End = duration * 0.38; // 18% - 38%: Logo forms
    const tStep3End = duration * 0.52; // 38% - 52%: Logo completes
    const tStep4End = duration * 0.68; // 52% - 68%: Wordmark appears
    const tStep5End = duration * 0.85; // 68% - 85%: Tagline & loader appears, progress 0-45%
    const tTotal = duration;          // 85% - 100%: Loader completes 100%

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      if (elapsed < tStep1End) {
        setStep(1);
        setLoaderProgress(0);
      } else if (elapsed < tStep2End) {
        setStep(2);
        setLoaderProgress(0);
      } else if (elapsed < tStep3End) {
        setStep(3);
        setLoaderProgress(0);
      } else if (elapsed < tStep4End) {
        setStep(4);
        setLoaderProgress(0);
      } else if (elapsed < tStep5End) {
        setStep(5);
        // Progress interpolates from 0% to ~45%
        const subFrac = (elapsed - tStep4End) / (tStep5End - tStep4End);
        setLoaderProgress(Math.min(45, Math.round(subFrac * 45)));
      } else if (elapsed < tTotal) {
        setStep(6);
        // Progress interpolates from 45% to 100%
        const subFrac = (elapsed - tStep5End) / (tTotal - tStep5End);
        setLoaderProgress(Math.min(100, Math.round(45 + subFrac * 55)));
      } else {
        setStep(6);
        setLoaderProgress(100);
        // Hold briefly at 100% then exit smoothly
        setTimeout(handleFinish, 200);
        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoPlay, duration, fixedStep, handleFinish]);

  if (isUnmounted && !inline && !fixedStep) {
    return null;
  }

  const stepLabels: Record<AnimationStep, string> = {
    1: "Logo strokes appear",
    2: "Logo forms",
    3: "Logo completes",
    4: "Wordmark appears",
    5: "Tagline and loader appear",
    6: "Loader completes",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="UniSync starting animation"
      onClick={clickToSkip && !inline && !fixedStep ? handleFinish : undefined}
      className={cn(
        inline
          ? "relative flex flex-col items-center justify-center p-8 bg-card rounded-2xl border border-border shadow-xs select-none"
          : "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/98 backdrop-blur-md select-none",
        isExiting ? "opacity-0 scale-[0.99] pointer-events-none" : "opacity-100 scale-100",
        "transition-all duration-400 ease-out",
        className
      )}
    >
      {/* Soft background ambient light */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(1000px circle at 50% 45%, color-mix(in oklab, var(--sidebar-primary) 7%, transparent), transparent 70%)",
        }}
      />

      {/* Skip button in upper right */}
      {showSkipButton && !inline && !fixedStep && !isExiting && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="absolute top-6 right-6 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-full border border-border/60 transition-colors shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>Skip intro</span>
          <span aria-hidden="true" className="text-[10px]">
            &rarr;
          </span>
        </button>
      )}

      {/* Main Centered Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm w-full">
        {/* Animated Mark */}
        <AnimatedUniSyncMark step={step} progress={loaderProgress} className="mb-4 sm:mb-5" />

        {/* Wordmark (Step 4+) */}
        <div
          className={cn(
            "transition-all duration-600 ease-out",
            step >= 4
              ? "opacity-100 translate-y-0 filter-none"
              : "opacity-0 translate-y-3 blur-xs pointer-events-none"
          )}
        >
          <h1 className="font-heading text-3xl sm:text-[2.25rem] font-semibold tracking-tight text-foreground leading-none">
            UniSync
          </h1>
        </div>

        {/* Tagline (Step 5+) */}
        <div
          className={cn(
            "mt-2 transition-all duration-500 ease-out",
            step >= 5
              ? "opacity-100 translate-y-0 filter-none"
              : "opacity-0 translate-y-2 blur-2xs pointer-events-none"
          )}
        >
          <p className="text-muted-foreground text-xs sm:text-sm font-medium tracking-normal">
            One platform. Every operation.
          </p>
        </div>

        {/* Progress Loader Bar (Step 5+) */}
        <div
          className={cn(
            "mt-5 w-48 sm:w-56 transition-all duration-500 ease-out",
            step >= 5 ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <div className="relative h-1 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-200 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
              style={{ width: `${loaderProgress}%` }}
            />
          </div>
        </div>

        {/* Optional Storyboard Frame Label */}
        {showStepIndicator && (
          <div className="mt-8 pt-4 border-t border-border/50 w-full flex items-center justify-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              0{step}
            </span>
            <span className="text-xs text-muted-foreground/60">—</span>
            <span className="text-xs font-medium text-muted-foreground">
              {stepLabels[step]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** In-memory flag so client-side navigation between sign-in and sign-up doesn't re-trigger */
let hasShownIntroInSession = false;

/**
 * Overlay component for Auth Layout
 * Automatically mounts when user lands on auth pages, plays the animation once per browser session/refresh,
 * and seamlessly dissolves to reveal the auth form underneath.
 */
export function StartingAnimationOverlay({
  force = false,
}: {
  force?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check URL parameters for explicit override: ?intro=1 or ?intro=true
    const searchParams = new URLSearchParams(window.location.search);
    const hasIntroParam = searchParams.get("intro") === "1" || searchParams.get("intro") === "true";
    const hasSkipParam = searchParams.get("skip") === "1" || searchParams.get("skip") === "true";

    if (hasSkipParam) {
      setShowAnimation(false);
      return;
    }

    if (force || hasIntroParam || !hasShownIntroInSession) {
      setShowAnimation(true);
      hasShownIntroInSession = true;
    }

    const replayHandler = () => {
      setShowAnimation(true);
    };
    window.addEventListener("unisync:replay-intro", replayHandler);
    return () => window.removeEventListener("unisync:replay-intro", replayHandler);
  }, [force]);

  if (!mounted || !showAnimation) {
    return null;
  }

  return (
    <StartingAnimation
      key={Date.now()}
      onComplete={() => {
        setShowAnimation(false);
      }}
      duration={3200}
      showSkipButton={true}
      clickToSkip={true}
    />
  );
}

/**
 * Replay button component for auth layout footer
 */
export function ReplayIntroButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("unisync:replay-intro"));
        }
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground text-xs transition-colors underline underline-offset-4 cursor-pointer inline-flex items-center gap-1",
        className
      )}
      title="Replay starting animation"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        className="size-3 stroke-[1.75]"
        aria-hidden="true"
      >
        <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9L2 6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 2.5v3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Replay intro</span>
    </button>
  );
}
