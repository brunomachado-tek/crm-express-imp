// Definição das etapas e das opções do formulário de repasse
// (comercial → implantação). Este é o arquivo para mexer quando o time
// revisar as perguntas: alterar aqui muda o formulário público, a barra de
// progresso e a tela de respostas ao mesmo tempo.
//
// Campos novos também precisam de coluna em `ClientIntake` (schema.prisma)
// e de leitura em `saveIntakeStep` (actions.ts).

export type Opcao = { value: string; label: string; hint?: string };

export const INTAKE_STEPS = [
  {
    n: 1,
    titulo: "Empresa",
    descricao: "O que complementa o cadastro (o resto já veio do contrato).",
  },
  {
    n: 2,
    titulo: "Contatos",
    descricao: "Quem a implantação vai procurar no dia a dia.",
  },
  {
    n: 3,
    titulo: "Operação",
    descricao: "Como o cliente opera hoje. Define o esforço da implantação.",
  },
  {
    n: 4,
    titulo: "Contratação",
    descricao: "Expectativas de prazo e treinamento.",
  },
  {
    n: 5,
    titulo: "Fiscal e observações",
    descricao: "Regime tributário e o que mais a equipe precisa saber.",
  },
] as const;

export const TOTAL_ETAPAS = INTAKE_STEPS.length;

// ─── Etapa 1: empresa ──────────────────────────────────────────────

export const SEGMENTOS: Opcao[] = [
  { value: "RESTAURANTE", label: "Restaurante comercial", hint: "À la carte, self-service, bistrô" },
  { value: "COLETIVA", label: "Refeição coletiva", hint: "Industrial, corporativa, terceirizada" },
  { value: "HOTELARIA", label: "Hotelaria", hint: "Hotel, resort, pousada" },
  { value: "SAUDE", label: "Saúde", hint: "Hospital, clínica, casa de repouso" },
  { value: "EDUCACAO", label: "Educação", hint: "Escola, universidade, creche" },
  { value: "PADARIA", label: "Padaria e confeitaria", hint: "Produção e varejo próprio" },
  { value: "VAREJO", label: "Varejo e mercado", hint: "Mercado, loja de conveniência" },
  { value: "OUTRO", label: "Outro", hint: "Detalhe nas observações" },
];

// ─── Etapa 3: operação ─────────────────────────────────────────────

export const REFEICOES_DIA: Opcao[] = [
  { value: "ATE_100", label: "Até 100" },
  { value: "101_500", label: "101 a 500" },
  { value: "501_1000", label: "501 a 1.000" },
  { value: "1001_3000", label: "1.001 a 3.000" },
  { value: "ACIMA_3000", label: "Acima de 3.000" },
  { value: "NAO_SE_APLICA", label: "Não se aplica" },
];

export const PERIODOS: Opcao[] = [
  { value: "CAFE", label: "Café da manhã" },
  { value: "ALMOCO", label: "Almoço" },
  { value: "JANTAR", label: "Jantar" },
  { value: "CEIA", label: "Ceia ou madrugada" },
];

export const TIPOS_SERVICO: Opcao[] = [
  { value: "SELF_KG", label: "Self-service por quilo" },
  { value: "SELF_LIVRE", label: "Self-service livre" },
  { value: "A_LA_CARTE", label: "À la carte" },
  { value: "MARMITEX", label: "Marmitex e delivery" },
  { value: "BUFFET", label: "Buffet fixo ou eventos" },
  { value: "LANCHONETE", label: "Lanchonete e balcão" },
];

export const FICHA_TECNICA: Opcao[] = [
  { value: "COMPLETA", label: "Sim, completa", hint: "Todas as receitas mapeadas" },
  { value: "PARCIAL", label: "Parcial", hint: "Algumas receitas ou desatualizada" },
  { value: "NAO", label: "Não possui", hint: "Vai montar durante a implantação" },
];

export const NUTRICIONISTA: Opcao[] = [
  { value: "PROPRIO", label: "Sim, próprio" },
  { value: "TERCEIRIZADO", label: "Sim, terceirizado" },
  { value: "NAO", label: "Não possui", hint: "O dono ou o gestor assume o cardápio" },
];

export const MIGRAR_DADOS: Opcao[] = [
  { value: "SIM", label: "Sim, migração completa" },
  { value: "PARCIAL", label: "Parcial", hint: "Só cadastros essenciais" },
  { value: "NAO", label: "Não, começa do zero" },
];

export const SIM_NAO: Opcao[] = [
  { value: "SIM", label: "Sim" },
  { value: "NAO", label: "Não" },
];

// ─── Etapa 4: contratação ──────────────────────────────────────────

export const URGENCIA: Opcao[] = [
  { value: "NORMAL", label: "Prazo normal", hint: "Segue o cronograma padrão" },
  { value: "ALTA", label: "Tem data crítica", hint: "Inauguração, contrato, auditoria" },
  { value: "BAIXA", label: "Sem pressa", hint: "Cliente pediu para começar depois" },
];

export const FORMATO_TREINAMENTO: Opcao[] = [
  { value: "REMOTO", label: "Remoto" },
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "HIBRIDO", label: "Híbrido" },
];

// ─── Etapa 5: fiscal ───────────────────────────────────────────────

export const REGIME_TRIBUTARIO: Opcao[] = [
  { value: "SIMPLES", label: "Simples Nacional" },
  { value: "PRESUMIDO", label: "Lucro Presumido" },
  { value: "REAL", label: "Lucro Real" },
  { value: "MEI", label: "MEI" },
  { value: "IMUNE", label: "Imune ou isenta", hint: "Entidade sem fins lucrativos" },
  { value: "NAO_SEI", label: "Não sei informar" },
];

export const DOCUMENTOS_FISCAIS: Opcao[] = [
  { value: "NFE", label: "NF-e", hint: "Nota fiscal eletrônica" },
  { value: "NFCE", label: "NFC-e", hint: "Consumidor final" },
  { value: "SAT", label: "SAT ou ECF" },
  { value: "NFSE", label: "NFS-e", hint: "Serviços" },
  { value: "NENHUM", label: "Não emite" },
];

export const CERTIFICADO_DIGITAL: Opcao[] = [
  { value: "A1", label: "Possui A1" },
  { value: "A3", label: "Possui A3" },
  { value: "NAO", label: "Não possui" },
  { value: "NAO_SEI", label: "Não sei informar" },
];

// ─── Serialização das múltiplas escolhas ───────────────────────────
// SQLite não tem lista escalar: as múltiplas escolhas viram texto com "|".

const SEP = "|";

export function joinChoices(values: string[]): string | null {
  const limpos = values.map((v) => v.trim()).filter(Boolean);
  return limpos.length > 0 ? limpos.join(SEP) : null;
}

export function splitChoices(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(SEP).filter(Boolean);
}

// Traduz valores guardados para os rótulos legíveis (tela de respostas).
export function labelDe(opcoes: Opcao[], value: string | null | undefined): string {
  if (!value) return "não informado";
  return opcoes.find((o) => o.value === value)?.label ?? value;
}

export function labelsDe(opcoes: Opcao[], value: string | null | undefined): string {
  const vals = splitChoices(value);
  if (vals.length === 0) return "não informado";
  return vals.map((v) => opcoes.find((o) => o.value === v)?.label ?? v).join(", ");
}
