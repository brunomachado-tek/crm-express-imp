// Leitura do "Plano de Projeto" (PDF). Complementa o contrato no cadastro do
// cliente: o plano traz os MÓDULOS contratados por nome (o contrato só vende o
// produto), o usuário-chave, os coordenadores e a previsão de início/término.
// Mesma abordagem do contrato: leitura por âncoras do modelo, sem IA. O que não
// for reconhecido volta em `camposNaoLidos` para conferência na tela.

export type LeituraPlano = {
  ok: boolean;
  erro?: string;
  razaoSocial: string | null;
  propostaNumero: string | null;
  coordenadorCliente: string | null;
  coordenadorTeknisa: string | null;
  usuarioChaveNome: string | null;
  usuarioChaveEmail: string | null;
  usuarioChaveCpf: string | null;
  previsaoInicio: string | null; // aaaa-mm-dd
  previsaoTermino: string | null; // aaaa-mm-dd
  horasTreinamento: number | null;
  // Nomes dos módulos declarados nas ENTREGAS ("Módulo X:"), para casar com o
  // catálogo do CRM na action (que tem acesso ao banco).
  modulosDeclarados: string[];
  camposNaoLidos: string[];
};

function normaliza(t: string) {
  return t.replace(/\s+/g, " ").trim();
}

function dataBr(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function grupo(re: RegExp, t: string): string | null {
  const m = t.match(re);
  return m ? m[1].trim() : null;
}

export async function lerPlanoProjeto(bytes: Uint8Array): Promise<LeituraPlano> {
  const vazio: LeituraPlano = {
    ok: false,
    razaoSocial: null,
    propostaNumero: null,
    coordenadorCliente: null,
    coordenadorTeknisa: null,
    usuarioChaveNome: null,
    usuarioChaveEmail: null,
    usuarioChaveCpf: null,
    previsaoInicio: null,
    previsaoTermino: null,
    horasTreinamento: null,
    modulosDeclarados: [],
    camposNaoLidos: [],
  };

  let t: string;
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractText(doc, { mergePages: true });
    t = normaliza(Array.isArray(text) ? text.join(" ") : text);
  } catch {
    return { ...vazio, erro: "Não foi possível abrir o PDF do plano de projeto." };
  }

  if (!/plano de projeto/i.test(t)) {
    return {
      ...vazio,
      erro: "Este PDF não parece ser um Plano de Projeto da Teknisa. Confira o arquivo.",
    };
  }

  const razaoSocial = grupo(/Cliente\s+(.+?)\s+Projeto\s/i, t);
  const propMatch = t.match(/Proposta\(s\)\s+(?:SAAS|LUSO)\s*-\s*\d{6}(\d+)-\d+/i);
  const propostaNumero = propMatch ? propMatch[1] : null;
  const coordenadorCliente = grupo(/Coordenador do Projeto\s*\(Cliente\)\s+(.+?)\s+Coordenador do Projeto\s*\(Teknisa\)/i, t);
  const coordenadorTeknisa = grupo(/Coordenador do Projeto\s*\(Teknisa\)\s+(.+?)\s+Data\s/i, t);
  const usuarioChaveNome = grupo(/Nome do usu[áa]rio chave:\s*(.+?)\s+E-?mail:/i, t);
  const usuarioChaveEmail = grupo(/E-?mail:\s*(\S+@\S+?)\s+CPF:/i, t);
  const usuarioChaveCpf = grupo(/CPF:\s*([\d.\-]+)/i, t);
  const previsaoInicio = dataBr(grupo(/Previs[ãa]o de in[íi]cio do projeto\s+(\d{2}\/\d{2}\/\d{4})/i, t));
  const previsaoTermino = dataBr(grupo(/Previs[ãa]o de t[ée]rmino do projeto\s+(\d{2}\/\d{2}\/\d{4})/i, t));
  const horasMatch = t.match(/Total de Horas Previstas\s+(\d+)\s*:/i);
  const horasTreinamento = horasMatch ? parseInt(horasMatch[1], 10) : null;

  // Módulos declarados: cabeçalhos "Módulo X:" da seção ENTREGAS. Cada um vira
  // um candidato a casar com o catálogo do CRM.
  const modulosDeclarados = [...t.matchAll(/M[óo]dulo\s+([^:]{2,60}?)\s*:/gi)]
    .map((m) => m[1].trim())
    .filter((s, i, arr) => s.length > 2 && arr.indexOf(s) === i);

  const camposNaoLidos: string[] = [];
  if (!razaoSocial) camposNaoLidos.push("cliente");
  if (modulosDeclarados.length === 0) camposNaoLidos.push("módulos contratados");
  if (!usuarioChaveNome) camposNaoLidos.push("usuário-chave");

  return {
    ok: true,
    razaoSocial,
    propostaNumero,
    coordenadorCliente,
    coordenadorTeknisa,
    usuarioChaveNome,
    usuarioChaveEmail,
    usuarioChaveCpf,
    previsaoInicio,
    previsaoTermino,
    horasTreinamento,
    modulosDeclarados,
    camposNaoLidos,
  };
}

// Casa um nome de módulo declarado no plano com o nome de um módulo do catálogo,
// por inclusão normalizada (ex.: "Custos" ↔ "Custo", "Planejamento Alimentação
// Industrial" ↔ "Planejamento").
export function moduloCasa(declarado: string, nomeCatalogo: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const a = norm(declarado);
  const b = norm(nomeCatalogo);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}
