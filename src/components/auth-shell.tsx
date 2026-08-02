import Image from "next/image";

export const authInput =
  "w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/brand/teknisa.svg"
            alt="Teknisa"
            width={188}
            height={36}
            priority
            className="mx-auto mb-4"
          />
          <h1 className="text-xl font-semibold text-primary">CRM Express</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
