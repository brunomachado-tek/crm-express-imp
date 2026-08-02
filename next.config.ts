import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O anexo de contrato sobe por Server Action, e o limite padrão é 1MB:
      // um PDF assinado costuma passar disso e falharia sem explicação.
      // Deixa folga sobre o teto de 8MB validado em uploadDocument.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
