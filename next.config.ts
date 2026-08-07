import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O anexo de contrato sobe por Server Action, e o limite padrão é 1MB:
      // um PDF assinado costuma passar disso e falharia sem explicação.
      // Deixa folga sobre o teto de 4MB validado em uploadDocument (o limite de
      // payload das funções do Netlify é ~6MB).
      bodySizeLimit: "5mb",
    },
  },
  // As fontes de marca do PDF (TTF) são lidas do disco em runtime pela rota do
  // acompanhamento. Força incluí-las no bundle da função serverless (senão o
  // Netlify não empacota os .ttf e a geração do PDF quebra em produção).
  outputFileTracingIncludes: {
    "/api/projetos/[projetoId]/acompanhamento": ["./src/pdf/fonts/**"],
  },
};

export default nextConfig;
