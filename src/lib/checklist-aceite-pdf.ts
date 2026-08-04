import { extractText, getDocumentProxy } from "unpdf";

// Lê o "Check List de Aceite" (email exportado do Zimbra) por âncoras de rótulo,
// de forma determinística (sem IA). Traz os contatos do cliente (sponsor,
// representante legal, responsável financeiro, primeiro acesso) para completar
// o perfil. Se o layout mudar, o campo não reconhecido simplesmente não vem.

export type ContatoChecklist = {
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string;
};
export type LeituraChecklist = { ok: boolean; contatos: ContatoChecklist[] };

// Rótulos na ordem em que aparecem: o valor de cada um é o texto até o próximo.
const LABELS = [
  "Número do Ticket",
  "Nome Completo - Colaborador",
  "E-mail Teknisa",
  "Nome Fantasia",
  "Razão Social",
  "Segmento do Cliente Teknisa",
  "Nome Completo - Sponsor do Cliente",
  "E-mail - Sponsor",
  "Telefone - Sponsor",
  "Nome Completo - Representante Legal",
  "E-mail - Representante Legal Cliente",
  "Telefone - Representante Legal Cliente",
  "Nome Completo - Responsável Financeiro",
  "Nome Telefone 1 - Contato Financeiro",
  "E-mail 1 - Para recebimento de Nota Fiscal",
  "E-mail 2 - Para recebimento de Nota Fiscal",
  "Tipo de Hospedagem",
  "Tipo de Organização",
  "Nome Completo - Primeiro Acesso",
  "E-mail - Primeiro Acesso",
  "Telefone - Primeiro Acesso",
  "Termos e Condições",
];

function limpa(t: string): string {
  return t
    .replace(/\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}\s*Zimbra\s*https?:\/\/\S+\s*\d\/\d/gi, " ")
    .replace(/©\s*Documenta[çc][ãa]o Teknisa\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function campos(text: string): Record<string, string> {
  const t = limpa(text);
  const pos = LABELS.map((l) => ({ l, i: t.indexOf(l) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  const out: Record<string, string> = {};
  for (let k = 0; k < pos.length; k++) {
    const start = pos[k].i + pos[k].l.length;
    const end = k + 1 < pos.length ? pos[k + 1].i : t.length;
    out[pos[k].l] = t.slice(start, end).trim();
  }
  return out;
}

const soEmail = (v: string | null): string | null => {
  const m = (v ?? "").match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return m ? m[0] : null;
};
const soTelefone = (v: string | null): string | null => {
  const m = (v ?? "").match(/\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}/);
  return m ? m[0].trim() : null;
};

export async function lerChecklistAceite(bytes: Uint8Array): Promise<LeituraChecklist> {
  let text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    text = (await extractText(pdf, { mergePages: true })).text;
  } catch {
    return { ok: false, contatos: [] };
  }
  if (!/Check ?List de Aceite/i.test(text) && !/Sponsor do Cliente/i.test(text)) {
    return { ok: false, contatos: [] };
  }

  const c = campos(text);
  const val = (k: string) => (c[k] ?? "").trim() || null;

  const brutos: (ContatoChecklist | null)[] = [
    {
      cargo: "Sponsor",
      nome: val("Nome Completo - Sponsor do Cliente") ?? "",
      email: soEmail(val("E-mail - Sponsor")),
      telefone: soTelefone(val("Telefone - Sponsor")),
    },
    {
      cargo: "Representante legal",
      nome: val("Nome Completo - Representante Legal") ?? "",
      email: soEmail(val("E-mail - Representante Legal Cliente")),
      telefone: soTelefone(val("Telefone - Representante Legal Cliente")),
    },
    {
      cargo: "Responsável financeiro",
      nome: val("Nome Completo - Responsável Financeiro") ?? "",
      email: soEmail(val("E-mail 1 - Para recebimento de Nota Fiscal")),
      telefone: null,
    },
    {
      cargo: "Primeiro acesso",
      nome: val("Nome Completo - Primeiro Acesso") ?? "",
      email: soEmail(val("E-mail - Primeiro Acesso")),
      telefone: soTelefone(val("Telefone - Primeiro Acesso")),
    },
  ];

  const validos = brutos.filter((b): b is ContatoChecklist => !!b && b.nome.length > 1);

  // Mesma pessoa em papéis diferentes (ex.: Sponsor e Primeiro acesso) vira um
  // contato só, juntando os cargos e preenchendo email/telefone que faltarem.
  const contatos: ContatoChecklist[] = [];
  for (const c of validos) {
    const chave = c.nome.trim().toLowerCase();
    const existe = contatos.find((m) => m.nome.trim().toLowerCase() === chave);
    if (existe) {
      if (!existe.cargo.split(" / ").includes(c.cargo)) existe.cargo += ` / ${c.cargo}`;
      existe.email = existe.email ?? c.email;
      existe.telefone = existe.telefone ?? c.telefone;
    } else {
      contatos.push({ ...c });
    }
  }
  return { ok: contatos.length > 0, contatos };
}
