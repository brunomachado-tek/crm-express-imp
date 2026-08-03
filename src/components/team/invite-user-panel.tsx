"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

export function InviteUserPanel({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        <UserPlus className="h-4 w-4" /> Criar usuário
      </button>
    );
  }

  return (
    <div className="w-full bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Criar usuário
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
