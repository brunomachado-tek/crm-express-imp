import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { canDeleteClient, canHardDeleteClient } from "@/lib/permissions";
import { restoreClientAction } from "@/lib/actions";
import { ProductBadge, StageBadge } from "@/components/badges";
import { DeleteClientPanel } from "@/components/clientes/delete-client-panel";
import { Archive, Building2, RotateCcw, Search } from "lucide-react";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string; arquivado?: string; removido?: string }>;
}) {
  const user = await requireUser();
  const { q, arquivados, arquivado, removido } = await searchParams;
  const query = (q ?? "").trim();
  const verArquivados = arquivados === "1";

  const busca = query
    ? [
        { razaoSocial: { contains: query } },
        { propostaNumero: { contains: query } },
        { cnpj: { contains: query } },
      ]
    : undefined;

  const clients = await db.client.findMany({
    where: {
      // arquivados só aparecem quando pedidos de propósito
      deletedAt: verArquivados ? { not: null } : null,
      ...(busca ? { OR: busca } : {}),
    },
    include: {
      projects: {
        where: { deleted: verArquivados ? undefined : false },
        orderBy: { createdAt: "desc" },
        include: { stage: true },
      },
      contracts: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const canHardDelete = canHardDeleteClient(user);
  const totalArquivados = await db.client.count({ where: { deletedAt: { not: null } } });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {verArquivados ? "Clientes arquivados" : "Clientes"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length === 1 ? "" : "s"}
            {verArquivados ? " arquivado" + (clients.length === 1 ? "" : "s") : ""}
          </p>
        </div>
        <form className="relative" action="/clientes">
          {verArquivados && <input type="hidden" name="arquivados" value="1" />}
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Razão social, proposta ou CNPJ"
            className="h-10 w-72 rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </form>
      </div>

      {arquivado === "1" && (
        <div className="rounded-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          Cliente arquivado. Ele some das listas, mas o histórico fica guardado.
        </div>
      )}
      {removido === "1" && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-2.5 text-sm text-success">
          Cliente apagado em definitivo.
        </div>
      )}

      {(totalArquivados > 0 || verArquivados) && (
        <Link
          href={verArquivados ? "/clientes" : "/clientes?arquivados=1"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {verArquivados ? (
            <>
              <RotateCcw className="h-4 w-4" /> Voltar aos clientes ativos
            </>
          ) : (
            <>
              <Archive className="h-4 w-4" /> Ver arquivados ({totalArquivados})
            </>
          )}
        </Link>
      )}

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-lg">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">
            {query ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {query
              ? "Tente outro termo ou confira o número da proposta."
              : "Cadastre o primeiro cliente para iniciar o funil."}
          </p>
          <Link
            href="/clientes/novo"
            className="h-10 px-4 inline-flex items-center rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Cadastrar cliente
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Proposta</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Projetos</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Cadastro</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:text-primary">
                      {c.razaoSocial}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.cidade ?? "sem cidade"}{c.uf ? `/${c.uf}` : ""} {c.cnpj ? `· ${c.cnpj}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {c.propostaNumero ?? "não informada"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.projects.map((p) => (
                        <Link key={p.id} href={`/projetos/${p.id}`} className="inline-flex items-center gap-1">
                          <ProductBadge line={p.productLine} />
                          <StageBadge label={p.stage.nome} />
                        </Link>
                      ))}
                      {c.projects.length === 0 && <span className="text-muted-foreground">nenhum</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {fmtDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {verArquivados ? (
                      canDeleteClient(user, c.projects) && (
                        <form action={restoreClientAction} className="inline">
                          <input type="hidden" name="clientId" value={c.id} />
                          <button
                            title={`Restaurar ${c.razaoSocial}`}
                            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </button>
                        </form>
                      )
                    ) : (
                      canDeleteClient(user, c.projects) && (
                        <DeleteClientPanel
                          clientId={c.id}
                          nome={c.razaoSocial}
                          projetos={c.projects.length}
                          contratos={c.contracts.length}
                          canHardDelete={canHardDelete}
                          variant="icone"
                        />
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
