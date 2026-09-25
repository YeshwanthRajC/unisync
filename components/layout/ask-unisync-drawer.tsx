"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BotIcon,
  CheckIcon,
  CornerDownLeftIcon,
  RotateCcwIcon,
  SparklesIcon,
  UserIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { sendChatMessageAction } from "@/app/(dashboard)/actions/chat";
import type { AgentConfirmationRequest, AgentToolExecution } from "@/lib/ai/agent";
import type { AiMessage } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AskUniSyncDrawerProps {
  organizationName: string;
}

const SUGGESTIONS = [
  "What appointments are scheduled for today?",
  "Check low stock alerts in inventory",
  "Search for recent patients",
  "How many open follow-ups do we have?",
];

export function AskUniSyncDrawer({ organizationName }: AskUniSyncDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [toolLogs, setToolLogs] = useState<AgentToolExecution[]>([]);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<AgentConfirmationRequest | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Global shortcut: ⌘J / Ctrl+J
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, pendingConfirmation]);

  // Focus textarea when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    const nextMessages: AiMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);

    try {
      const response = await sendChatMessageAction({ messages: nextMessages });
      if (response.ok) {
        setMessages(response.data.updatedMessages);
        if (response.data.toolExecutions?.length) {
          setToolLogs((prev) => [...prev, ...response.data.toolExecutions]);
        }
        setPendingConfirmation(response.data.confirmationRequired ?? null);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I encountered an error: ${response.error || "Unknown error"}`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble reaching the clinical assistant service.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmation(confirmed: boolean) {
    if (!pendingConfirmation || isLoading) return;

    setIsLoading(true);
    const confirmationData = {
      toolCallId: pendingConfirmation.toolCallId,
      confirmed,
    };
    setPendingConfirmation(null);

    try {
      const response = await sendChatMessageAction({
        messages,
        confirmedCall: confirmationData,
      });

      if (response.ok) {
        setMessages(response.data.updatedMessages);
        if (response.data.toolExecutions?.length) {
          setToolLogs((prev) => [...prev, ...response.data.toolExecutions]);
        }
        setPendingConfirmation(response.data.confirmationRequired ?? null);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Action failed: ${response.error || "Execution error"}`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to submit action confirmation.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setToolLogs([]);
    setPendingConfirmation(null);
    setInput("");
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Ask UniSync Assistant"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <SparklesIcon className="size-4 animate-pulse text-amber-300" />
        <span className="font-semibold">Ask UniSync</span>
        <kbd className="hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
          ⌘J
        </kbd>
      </button>

      {/* Slide-over Drawer Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col p-0 sm:max-w-md md:max-w-lg"
          showCloseButton={false}
        >
          {/* Header */}
          <SheetHeader className="border-b px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <SparklesIcon className="size-4 text-amber-300" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold tracking-tight">
                    Ask UniSync
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Clinical AI Assistant · {organizationName}
                  </SheetDescription>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    title="Clear conversation"
                    className="size-8 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcwIcon className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Conversation Stream */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BotIcon className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-semibold text-foreground">
                    How can I assist your clinic?
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Ask to search patients, check upcoming appointments, inspect inventory stock, or draft patient emails.
                  </p>
                </div>

                <div className="w-full space-y-2 pt-2">
                  <p className="text-left text-[11px] font-medium text-muted-foreground">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSend(suggestion)}
                        className="rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/70 hover:border-primary/40"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages
                  .filter(
                    (m): m is Extract<AiMessage, { content: string }> =>
                      m.role !== "tool" && Boolean(m.content),
                  )
                  .map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2.5 ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {m.role === "assistant" && (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <BotIcon className="size-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 border text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>

                      {m.role === "user" && (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                          <UserIcon className="size-4" />
                        </div>
                      )}
                    </div>
                  ))}

                {/* Tool execution notifications */}
                {toolLogs.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {toolLogs.slice(-2).map((log, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded border border-muted bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        <WrenchIcon className="size-3 text-primary" />
                        <span className="font-mono">{log.toolName}</span>
                        <span className="truncate text-xs">
                          {typeof log.result === "object" && log.result !== null
                            ? "✓ executed"
                            : "completed"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmation Flow Card */}
                {pendingConfirmation && (
                  <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-amber-400 text-amber-700 dark:text-amber-300 text-[10px]"
                            >
                              Confirmation Required
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-foreground">
                            {pendingConfirmation.prompt}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirmation(false)}
                          disabled={isLoading}
                          className="h-7 text-xs"
                        >
                          <XIcon className="mr-1 size-3" />
                          Decline
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleConfirmation(true)}
                          disabled={isLoading}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckIcon className="mr-1 size-3" />
                          Confirm Action
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <SparklesIcon className="size-3.5 animate-spin" />
                    </div>
                    <span className="animate-pulse">UniSync is thinking...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Input */}
          <div className="border-t bg-background p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading || Boolean(pendingConfirmation)}
                placeholder={
                  pendingConfirmation
                    ? "Please confirm or decline the action above..."
                    : "Ask UniSync about appointments, inventory, patients..."
                }
                rows={1}
                className="w-full resize-none rounded-xl border bg-muted/20 py-2.5 pl-3 pr-10 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading || Boolean(pendingConfirmation)}
                className="absolute right-1.5 size-7 rounded-lg"
              >
                <CornerDownLeftIcon className="size-3.5" />
              </Button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              UniSync AI may make mistakes. High-impact operations always require your confirmation.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
