"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  StartingAnimation,
  AnimatedUniSyncMark,
  type AnimationStep,
} from "@/components/brand/starting-animation";

export default function IntroPreviewPage() {
  const [activeTab, setActiveTab] = useState<"storyboard" | "player">("storyboard");
  const [playerKey, setPlayerKey] = useState(0);
  const [speed, setSpeed] = useState<number>(3200);

  const stepsData: Array<{
    id: AnimationStep;
    num: string;
    title: string;
    description: string;
  }> = [
    {
      id: 1,
      num: "01",
      title: "Logo strokes appear",
      description:
        "The strokes of the UniSync mark begin drawing in. The main loop and top bar emerge along their trajectories.",
    },
    {
      id: 2,
      num: "02",
      title: "Logo forms",
      description:
        "The hairpin curve bends around and begins closing. The top offset bar reaches alignment and the convergence dot appears.",
    },
    {
      id: 3,
      num: "03",
      title: "Logo completes",
      description:
        "All strokes snap to 100% completion. The satellite dot locks in with an overshoot spring, backed by a subtle ambient radial glow.",
    },
    {
      id: 4,
      num: "04",
      title: "Wordmark appears",
      description:
        "The crisp 'UniSync' title emerges cleanly below the mark with a soft upward glide and blur reveal.",
    },
    {
      id: 5,
      num: "05",
      title: "Tagline and loader appear",
      description:
        "The tagline 'One platform. Every operation.' fades in, and the pill loader bar initiates progress.",
    },
    {
      id: 6,
      num: "06",
      title: "Loader completes",
      description:
        "The progress indicator accelerates and fills to 100%, triggering the seamless exit fade into the platform auth screen.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                Design Spec &amp; Preview
              </span>
              <span className="text-muted-foreground text-xs font-mono">v1.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight mt-2 text-foreground">
              UniSync Starting Animation
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Authentic 6-stage starting sequence featuring the official UniSync converging mark,
              wordmark reveal, and smooth transition to auth.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/sign-in?intro=1"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition shadow-xs"
            >
              Test on Sign In &rarr;
            </Link>
            <Link
              href="/sign-up?intro=1"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium border border-border bg-card text-card-foreground rounded-lg hover:bg-muted transition"
            >
              Test on Sign Up
            </Link>
          </div>
        </header>

        {/* View Mode Switcher */}
        <div className="flex items-center justify-between">
          <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("storyboard")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "storyboard"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Storyboard View (6 Frames)
            </button>
            <button
              onClick={() => setActiveTab("player")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "player"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Live Animation Player
            </button>
          </div>

          {activeTab === "player" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Speed:</span>
              <button
                onClick={() => {
                  setSpeed(4500);
                  setPlayerKey((k) => k + 1);
                }}
                className={`px-2 py-1 text-xs rounded border ${
                  speed === 4500 ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
                }`}
              >
                0.7x (Slow)
              </button>
              <button
                onClick={() => {
                  setSpeed(3200);
                  setPlayerKey((k) => k + 1);
                }}
                className={`px-2 py-1 text-xs rounded border ${
                  speed === 3200 ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
                }`}
              >
                1.0x (Normal)
              </button>
              <button
                onClick={() => setPlayerKey((k) => k + 1)}
                className="px-3 py-1 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded border border-border"
              >
                ↻ Replay
              </button>
            </div>
          )}
        </div>

        {/* Storyboard View matching the reference screenshot */}
        {activeTab === "storyboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stepsData.map((step) => (
                <div
                  key={step.id}
                  className="bg-card rounded-2xl border border-border/70 overflow-hidden shadow-xs flex flex-col hover:border-border transition-colors"
                >
                  {/* Canvas representation */}
                  <div className="relative aspect-4/3 flex items-center justify-center p-6 bg-radial from-blue-500/[0.03] via-transparent to-transparent border-b border-border/40">
                    <div className="flex flex-col items-center justify-center text-center w-full max-w-[220px]">
                      {/* Logo Mark for this frame */}
                      <AnimatedUniSyncMark step={step.id} className="mb-3" />

                      {/* Wordmark (Step 4+) */}
                      <div
                        className={`transition-opacity duration-300 ${
                          step.id >= 4 ? "opacity-100" : "opacity-0 invisible"
                        }`}
                      >
                        <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                          UniSync
                        </span>
                      </div>

                      {/* Tagline (Step 5+) */}
                      <div
                        className={`mt-1 transition-opacity duration-300 ${
                          step.id >= 5 ? "opacity-100" : "opacity-0 invisible"
                        }`}
                      >
                        <p className="text-muted-foreground text-[11px] font-medium">
                          One platform. Every operation.
                        </p>
                      </div>

                      {/* Loader bar (Step 5+) */}
                      <div
                        className={`mt-3 w-40 transition-opacity duration-300 ${
                          step.id >= 5 ? "opacity-100" : "opacity-0 invisible"
                        }`}
                      >
                        <div className="h-1 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                            style={{
                              width: step.id === 5 ? "38%" : step.id === 6 ? "100%" : "0%",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Frame caption footer matching diagram */}
                  <div className="p-4 flex items-start gap-3 bg-muted/20">
                    <span className="font-mono text-xs font-bold text-muted-foreground pt-0.5">
                      {step.num}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-px w-4 bg-muted-foreground/30" />
                        <h3 className="text-xs font-semibold text-foreground tracking-tight">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Interactive Player */}
        {activeTab === "player" && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="relative h-[480px] w-full rounded-xl overflow-hidden border border-border/80 bg-background flex items-center justify-center">
              <StartingAnimation
                key={playerKey}
                duration={speed}
                inline={true}
                showSkipButton={false}
                showStepIndicator={true}
                clickToSkip={false}
                onComplete={() => {
                  // Keep it visible or allow replay
                }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <p>Click &quot;↻ Replay&quot; above to re-trigger the animation.</p>
              <p>Includes authentic stroke curvature, dot spring, and progressive loading bar.</p>
            </div>
          </div>
        )}

        {/* Platform Integration Summary */}
        <section className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            How it connects to the UniSync platform
          </h2>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
            <li>
              Mounted directly inside{" "}
              <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                app/(auth)/layout.tsx
              </code>{" "}
              as a lightweight client overlay.
            </li>
            <li>
              When unauthenticated users visit{" "}
              <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">/</code>,{" "}
              <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">/sign-in</code>, or{" "}
              <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">/sign-up</code>,
              the animation plays smoothly before revealing the page.
            </li>
            <li>
              The underlying sign-in/up form is rendered beneath the overlay, meaning zero flash of
              unstyled content and instant responsiveness the moment the loader completes.
            </li>
            <li>
              Includes an in-memory session gate so switching between Sign In and Sign Up does not
              re-trigger the animation, plus a discreet &quot;Replay intro&quot; button in the footer for
              testing.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
