// Conferência de identidade na importação do repasse.
//
// Regra do projeto: nunca duplicar registro e nunca descartar informação em
// silêncio. Por isso a comparação usa vários campos (CNPJ, razão social,
// email, telefone, nome) e, quando o que veio do formulário conflita com o que
// já está no CRM, o valor do cadastro é mantido e a divergência é reportada
// para alguém decidir, em vez de sobrescrever ou jogar fora.

export function normalizaTexto(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function normalizaEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

// Telefone: compara pelos últimos 8 dígitos, para não errar por DDD ou o
// nono dígito escrito de formas diferentes.
export function chaveTelefone(v: string | null | undefined): string {
  const d = soDigitos(v);
  return d.length >= 8 ? d.slice(-8) : "";
}

function tokens(nome: string | null | undefined): string[] {
  return normalizaTexto(nome).split(" ").filter((t) => t.length > 1);
}

// "Hosana Guida" e "Hosana Flores de Jesus Guida" são a mesma pessoa; exige
// pelo menos dois tokens em comum para não casar gente que só divide o
// primeiro nome.
export function nomesCompativeis(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  const [curto, longo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return curto.length >= 2 && curto.every((t) => longo.includes(t));
}

type Pessoa = { nome: string | null; email?: string | null; telefone?: string | null };

// Mesma pessoa se um identificador forte bate (email ou telefone), ou se o
// nome é compatível e nenhum identificador forte contradiz.
export function mesmaPessoa(a: Pessoa, b: Pessoa): boolean {
  const emailA = normalizaEmail(a.email);
  const emailB = normalizaEmail(b.email);
  const telA = chaveTelefone(a.telefone);
  const telB = chaveTelefone(b.telefone);

  const emailIgual = !!emailA && emailA === emailB;
  const telIgual = !!telA && telA === telB;
  if (emailIgual || telIgual) return true;

  const emailConflita = !!emailA && !!emailB && emailA !== emailB;
  const telConflita = !!telA && !!telB && telA !== telB;
  if (emailConflita || telConflita) return false;

  return nomesCompativeis(a.nome, b.nome);
}

// Compara um campo do cadastro com o que veio do formulário.
//  - "vazio": o CRM não tinha nada, pode preencher
//  - "igual": mesma informação, nada a fazer
//  - "conflito": valores diferentes, mantém o do CRM e reporta
export type Comparacao = "vazio" | "igual" | "conflito";

export function comparaCampo(
  atual: string | null | undefined,
  novo: string | null | undefined,
  modo: "texto" | "documento" = "texto"
): Comparacao {
  const n = (novo ?? "").trim();
  if (!n) return "igual"; // formulário não informou: nada muda
  const a = (atual ?? "").trim();
  if (!a) return "vazio";
  const iguais =
    modo === "documento"
      ? soDigitos(a) === soDigitos(n)
      : normalizaTexto(a) === normalizaTexto(n);
  return iguais ? "igual" : "conflito";
}
