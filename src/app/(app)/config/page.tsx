import { requireUser } from "@/lib/auth";
import { changeOwnPasswordAction } from "@/lib/actions";
import { ROLE_LABELS, PRODUCT_LABELS } from "@/lib/format";
import { Settings } from "lucide-react";

export default async function ConfigPage() {
  const user = await requireUser();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {user.name} · {ROLE_LABELS[user.role]}
          {user.productLine ? ` · ${PRODUCT_LABELS[user.productLine]}` : ""}
        </p>
      </div>

      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold">Trocar senha</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Mínimo de 8 caracteres. Se você entrou com a senha inicial (teknisa123), defina a sua aqui.
          Ao salvar, você segue conectado e as outras sessões são encerradas.
        </p>
        <form action={changeOwnPasswordAction} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Nova senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Salvar senha
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
