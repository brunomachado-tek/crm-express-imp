import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ActionToast } from "@/components/ui/action-toast";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/actions";
import { ROLE_LABELS, PRODUCT_LABELS } from "@/lib/format";
import {
  LayoutDashboard,
  KanbanSquare,
  Building2,
  Users,
  Bell,
  LogOut,
  Plus,
  Workflow,
  Settings,
  ListChecks,
} from "lucide-react";

// Limite superior (exclusivo) da semana atual = próxima segunda 00:00 UTC. Fica
// fora do componente para não cair no lint de pureza (new Date no render).
function limiteDaSemana(): Date {
  const now = new Date();
  const hoje = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = new Date(hoje).getUTCDay(); // 0=dom..6=sáb
  return new Date(hoje + (((7 - dow) % 7) + 1) * 24 * 60 * 60 * 1000);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Escopo das atividades do usuário (mesmo de "Minhas atividades").
  const escopo =
    user.role === "CONSULTOR"
      ? { consultantId: user.id }
      : user.role === "DIRETORIA"
        ? {}
        : { productLine: user.productLine ?? undefined };

  const [unread, semana] = await Promise.all([
    db.notification.count({
      where: { readAt: null, OR: [{ userId: null }, { userId: user.id }] },
    }),
    // atividades pendentes com prazo até o fim desta semana (inclui atrasadas)
    db.projectActivity.count({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        dueDate: { lt: limiteDaSemana() },
        project: { deleted: false, status: "ATIVO", ...escopo },
      },
    }),
  ]);

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/minhas-atividades", label: "Minhas atividades", icon: ListChecks, badge: semana },
    { href: "/funil", label: "Funil", icon: KanbanSquare },
    { href: "/clientes", label: "Clientes", icon: Building2 },
    { href: "/equipe", label: "Equipe", icon: Users },
    ...(user.role === "DIRETORIA" ? [{ href: "/pipeline", label: "Pipeline", icon: Workflow }] : []),
    { href: "/alertas", label: "Alertas", icon: Bell, badge: unread },
    { href: "/config", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex-1 flex min-h-screen">
      <Suspense fallback={null}>
        <ActionToast />
      </Suspense>
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <Link href="/" className="block">
            <Image src="/brand/teknisa.svg" alt="Teknisa" width={124} height={24} priority />
            <span className="block text-xs text-muted-foreground mt-1.5">
              CRM Express · Small Business
            </span>
          </Link>
        </div>

        <div className="p-3">
          <Link
            href="/clientes/novo"
            className="flex items-center justify-center gap-2 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="rounded-full bg-destructive text-white text-xs px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <p className="text-sm font-medium leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
              {user.productLine ? ` · ${PRODUCT_LABELS[user.productLine]}` : ""}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
    </div>
  );
}
