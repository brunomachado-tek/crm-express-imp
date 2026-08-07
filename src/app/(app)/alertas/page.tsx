import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";
import { fmtDate } from "@/lib/format";
import { Bell, BellOff, Check } from "lucide-react";

export default async function AlertasPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { OR: [{ userId: null }, { userId: user.id }] },
    include: { project: { include: { client: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alertas</h1>
          <p className="text-sm text-muted-foreground">
            {unread.length} não lido{unread.length === 1 ? "" : "s"}
          </p>
        </div>
        {unread.length > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-sm hover:bg-muted">
              <Check className="h-4 w-4" /> Marcar tudo como lido
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-lg">
          <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Nenhum alerta</h3>
          <p className="text-sm text-muted-foreground">
            Novos clientes, atrasos de SLA e handoffs aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 flex items-start gap-3 ${
                n.readAt ? "border-border bg-card opacity-70" : "border-primary/30 bg-card"
              }`}
            >
              <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.readAt ? "text-muted-foreground" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                {n.projectId ? (
                  <Link
                    href={
                      n.activityId
                        ? `/projetos/${n.projectId}#atividade-${n.activityId}`
                        : `/projetos/${n.projectId}`
                    }
                    className="text-sm font-medium hover:text-primary"
                  >
                    {n.titulo}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{n.titulo}</p>
                )}
                {n.corpo && <p className="text-sm text-muted-foreground mt-0.5">{n.corpo}</p>}
                <p className="text-xs text-muted-foreground mt-1">{fmtDate(n.createdAt)}</p>
              </div>
              {!n.readAt && (
                <form action={markNotificationRead}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button
                    className="h-8 px-2.5 rounded-md border border-border text-xs hover:bg-muted"
                    title="Marcar como lido"
                  >
                    Lido
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
