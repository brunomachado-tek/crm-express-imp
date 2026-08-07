import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

// Dados que o documento espera. Montados na rota a partir do projeto.
export type CampoPDF = { rotulo: string; valor: string };
export type ItemPDF = {
  titulo: string;
  descricao: string | null;
  pautas: string | null;
  observacao: string | null;
  campos: CampoPDF[];
};
export type GrupoPDF = { nome: string; items: ItemPDF[] };
export type AcompanhamentoData = {
  cliente: { razaoSocial: string; cnpj: string | null; local: string };
  produtoLabel: string;
  cor: string;
  consultor: string;
  etapa: string;
  contrato: string | null;
  assinatura: string | null;
  geradoEm: string;
  total: number;
  blocos: number;
  grupos: GrupoPDF[];
};

export function AcompanhamentoDoc(data: AcompanhamentoData): ReactElement<DocumentProps>;
