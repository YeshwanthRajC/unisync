"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3Icon,
  BoxesIcon,
  CalendarDaysIcon,
  HistoryIcon,
  HomeIcon,
  ListTodoIcon,
  MailIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  category: "Navigation" | "Actions";
  href?: string;
  icon: typeof HomeIcon;
  action?: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Listen for ⌘K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const items: CommandItem[] = [
    // Navigation
    { id: "nav-home", label: "Home Dashboard", category: "Navigation", href: "/home", icon: HomeIcon, keywords: ["overview", "pulse"] },
    { id: "nav-patients", label: "Patients", category: "Navigation", href: "/patients", icon: UsersIcon, keywords: ["people", "records"] },
    { id: "nav-appointments", label: "Appointments & Calendar", category: "Navigation", href: "/appointments", icon: CalendarDaysIcon, keywords: ["schedule", "booking"] },
    { id: "nav-bills", label: "Bills & Payments", category: "Navigation", href: "/bills", icon: ReceiptIcon, keywords: ["invoices", "revenue"] },
    { id: "nav-inventory", label: "Inventory & Stock", category: "Navigation", href: "/inventory", icon: BoxesIcon, keywords: ["supplies", "medicines"] },
    { id: "nav-followups", label: "Follow-ups & Recalls", category: "Navigation", href: "/followups", icon: ListTodoIcon, keywords: ["reminders", "tasks"] },
    { id: "nav-mail", label: "Patient Mail", category: "Navigation", href: "/mail", icon: MailIcon, keywords: ["email", "drafts", "outbox"] },
    { id: "nav-reports", label: "Reports & Analytics", category: "Navigation", href: "/reports", icon: BarChart3Icon, keywords: ["metrics", "stats", "revenue"] },
    { id: "nav-activity", label: "Activity Audit Log", category: "Navigation", href: "/activity", icon: HistoryIcon, keywords: ["audit", "logs", "timeline"] },
    { id: "nav-settings", label: "Clinic Settings", category: "Navigation", href: "/settings", icon: SettingsIcon, keywords: ["organization", "timezone", "currency"] },

    // Quick Actions
    { id: "act-new-patient", label: "Register New Patient", category: "Actions", href: "/patients/new", icon: PlusIcon, keywords: ["add patient"] },
    { id: "act-new-appointment", label: "Schedule Appointment", category: "Actions", href: "/appointments/new", icon: CalendarDaysIcon, keywords: ["book"] },
    { id: "act-new-bill", label: "Create Bill / Invoice", category: "Actions", href: "/bills/new", icon: ReceiptIcon, keywords: ["new bill", "charge"] },
    { id: "act-new-item", label: "Add Inventory Item", category: "Actions", href: "/inventory/new", icon: BoxesIcon, keywords: ["new stock"] },
    { id: "act-new-followup", label: "Schedule Follow-up Task", category: "Actions", href: "/followups/new", icon: ListTodoIcon, keywords: ["new recall"] },
    { id: "act-new-email", label: "Compose Patient Email", category: "Actions", href: "/mail/new", icon: MailIcon, keywords: ["new email", "draft"] },
    {
      id: "act-ask-unisync",
      label: "Ask UniSync Clinical Assistant",
      category: "Actions",
      icon: SparklesIcon,
      keywords: ["ai", "assistant", "agent", "chat"],
      action: () => {
        // Dispatch synthetic ⌘J event to trigger Ask UniSync drawer
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", metaKey: true, ctrlKey: true }));
      },
    },
  ];

  const filtered = query.trim()
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      })
    : items;

  function handleSelect(item: CommandItem) {
    setOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <>
      {/* Search trigger button for top bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center justify-between rounded-lg border bg-muted/30 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span className="flex items-center gap-2">
          <SearchIcon className="size-3.5" />
          <span>Search or jump to...</span>
        </span>
        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border">
          ⌘K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl animate-in zoom-in-95">
            {/* Input header */}
            <div className="flex items-center border-b px-3 py-2.5">
              <SearchIcon className="mr-2 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Results list */}
            <div className="max-h-80 overflow-y-auto p-2 text-xs">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No matching results found for &quot;{query}&quot;
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors focus:bg-muted focus:outline-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-6 items-center justify-center rounded bg-muted/60 text-muted-foreground">
                            <Icon className="size-3.5" />
                          </div>
                          <span className="font-medium text-foreground">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                          {item.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
              <span>Use arrows to navigate</span>
              <kbd className="rounded bg-muted px-1 py-0.5 border">ESC to close</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
