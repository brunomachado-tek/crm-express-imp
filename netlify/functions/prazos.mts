// Função agendada do Netlify: 1x/dia chama a rota interna que cria os avisos de
// prazo. Não usa Prisma (só fetch), então não tem problema de bundling do engine.
// Requer no Netlify: APP_URL (já existe) e CRON_SECRET (o mesmo da rota).
export const config = { schedule: "0 11 * * *" }; // 11:00 UTC = 08:00 BRT

export default async () => {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    return new Response("faltam APP_URL/CRON_SECRET", { status: 500 });
  }
  const res = await fetch(`${base}/api/cron/prazos?token=${encodeURIComponent(secret)}`);
  const corpo = await res.text();
  return new Response(`cron prazos: ${res.status} ${corpo}`);
};
