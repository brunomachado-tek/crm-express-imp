"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

export function FileUploadField({ label = "Enviar arquivo" }: { label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        name="file"
        required
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          if (!e.target.files?.[0]) return;
          setSending(true);
          e.currentTarget.form?.requestSubmit();
        }}
      />
      <button
        type="button"
        disabled={sending}
        onClick={() => inputRef.current?.click()}
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60 shrink-0"
      >
        {sending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" /> {label}
          </>
        )}
      </button>
    </>
  );
}
