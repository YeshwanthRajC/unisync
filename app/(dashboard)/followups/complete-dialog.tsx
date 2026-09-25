"use client";

import { useActionState, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import {
  completeFollowUpAction,
  cancelFollowUpAction,
} from "@/app/(dashboard)/followups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CompleteFollowUpButton({ followUpId }: { followUpId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(completeFollowUpAction, null);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 gap-1 text-xs text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950/40"
      >
        <CheckIcon className="size-3.5" />
        Complete
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={followUpId} />
      <Input
        name="notes"
        placeholder="Add note (optional)"
        className="h-8 max-w-44 text-xs"
      />
      <Button type="submit" size="sm" className="h-8 text-xs bg-green-700 hover:bg-green-800 text-white">
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(false)}
        className="h-8 px-2 text-xs"
      >
        Cancel
      </Button>
      {state && !state.ok ? (
        <span className="text-destructive text-xs">{state.error.message}</span>
      ) : null}
    </form>
  );
}

export function CancelFollowUpButton({ followUpId }: { followUpId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(cancelFollowUpAction, null);

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <XIcon className="size-3.5" />
        Dismiss
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={followUpId} />
      <Input
        name="notes"
        placeholder="Reason for dismissal"
        className="h-8 max-w-44 text-xs"
      />
      <Button type="submit" size="sm" variant="destructive" className="h-8 text-xs">
        Dismiss
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(false)}
        className="h-8 px-2 text-xs"
      >
        Back
      </Button>
      {state && !state.ok ? (
        <span className="text-destructive text-xs">{state.error.message}</span>
      ) : null}
    </form>
  );
}
