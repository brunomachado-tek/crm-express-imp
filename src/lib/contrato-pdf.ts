// Leitura do contrato Express assinado (PDF da Certisign) para preencher o
// cadastro do cliente. O comercial manda um único PDF contendo o par
// SAAS + LUSO, e é dele que sai quase tudo que o coordenador digitaria à mão.
//
// A leitura é feita por âncoras do modelo de contrato da Teknisa, não por IA:
// roda no próprio servidor, sem custo, sem internet e sem mandar dados do
// cliente para fora. Em troca, depende do texto do modelo. Se o jurídico
// mexer no contrato, o que deixar de ser reconhecido volta em
// `camposNaoLidos` e a tela pede o preenchimento manual daquele campo, em vez
// de inventar valor ou falhar em silêncio.
//
// Não há OCR: contrato Express chega sempre assinado digitalmente, com camada
// de texto. PDF escaneado é recusado com explicação.

export type ItemLido = {
  kind: "LICENCA" | "MANUTENCAO";
  solucao: string;
  tipoMedida: string | null;
  qtde: number;
  valorUnit: number | null;
  desconto: number | null;
  valorTotal: number | null;
};

export type ContratoLido = {
  kind: "SAAS" | "LUSO";
  numero: string;
  vigenciaMeses: number | null;
  valorLicenca: number | null;
  valorMensal: number | null;
  limiteSaasMb: number | null;
  horasTreinamento: number | null;
  prazoTreinamentoDias: number | null;
  itens: ItemLido[];
};

export type LeituraContrato = {
  ok: boolean;
  erro?: string;
  razaoSocial: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  propostaNumero: string | null;
  productLine: "TECFOOD" | "RETAIL" | null;
  dataAssinatura: string | null; // aaaa-mm-dd, para o <input type="date">
  contatoTeknisa: string | null;
  contratos: ContratoLido[];
  camposNaoLidos: string[];
};

// "1.234,56" (pt-BR) → 1234.56
function valorBr(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// "07/04/2026" → "2026-04-07"
function dataBr(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// O PDF vem com quebras de linha e espaços duplos herdados do layout. Uma
// única linha de texto normalizada deixa as âncoras estáveis.
function normaliza(texto: string) {
  return texto.replace(/\s+/g, " ").trim();
}

// Extrai o texto do PDF, em duas formas: o documento inteiro normalizado em
// uma linha (para as âncoras de cláusula) e a capa quebrada em linhas (para o
// cabeçalho, onde a posição na página é o que identifica o campo).
async function textoDoPdf(bytes: Uint8Array): Promise<{ inteiro: string; capa: string[] }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: false });
  const paginas = Array.isArray(text) ? text : [text];
  return {
    inteiro: normaliza(paginas.join(" ")),
    capa: (paginas[0] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
}

// Nome do comercial que vendeu, no cabeçalho da capa. Os rótulos ("Cliente:",
// "Contato Teknisa:") vêm de uma fonte com codificação quebrada e saem como
// lixo, então não dá para ancorar por eles. O que é legível é a ordem: a linha
// do cliente vem primeiro e a do contato Teknisa logo abaixo. Ancorar na razão
// social, que já foi lida da cláusula CONTRATANTE, é o caminho estável.
function leContatoTeknisa(capa: string[], razaoSocial: string | null) {
  if (!razaoSocial) return null;
  const chave = razaoSocial.slice(0, 24).toUpperCase();
  const i = capa.findIndex((l) => l.toUpperCase().includes(chave));
  if (i < 0 || i + 1 >= capa.length) return null;

  // tira o resto do rótulo ilegível que sobra no início da linha
  const nome = capa[i + 1].replace(/^[^\p{L}]*/u, "").trim();
  if (!/^\p{L}[\p{L}.'-]*(\s+\p{L}[\p{L}.'-]*)+$/u.test(nome)) return null;
  return nome;
}

// Bloco CONTRATANTE: razão social, endereço, cidade, UF, CEP e CNPJ.
// Formato do modelo:
//   CONTRATANTE <RAZÃO SOCIAL>, pessoa jurídica ... com sede na
//   <ENDEREÇO>, <CIDADE> - <UF> - CEP: <CEP>, regularmente inscrita no
//   CNPJ sob o nº <CNPJ>.
function leCliente(t: string) {
  const bloco = t.match(
    /CONTRATANTE\s+(.+?),\s*pessoa jurídica.*?com sede na\s+(.+?),\s*regularmente inscrita no CNPJ sob o n[ºo°]?\s*([\d./-]+)/i
  );
  if (!bloco) return null;

  const razaoSocial = bloco[1].trim();
  const cnpj = bloco[3].replace(/\.$/, "").trim();

  // "AV SAO PAULO 272 - JARDIM SILVIA, EMBU DAS ARTES - SP - CEP: 06.804-230"
  const local = bloco[2].match(/^(.*),\s*([^,]+?)\s*-\s*([A-Z]{2})\s*-\s*CEP:\s*([\d.-]+)$/i);
  if (!local) {
    return { razaoSocial, cnpj, endereco: bloco[2].trim(), cidade: null, uf: null, cep: null };
  }
  return {
    razaoSocial,
    cnpj,
    // alguns contratos trazem o complemento vazio e sobra um " - " no fim
    endereco: local[1].replace(/\s*-\s*$/, "").trim() || null,
    cidade: local[2].trim(),
    uf: local[3].toUpperCase(),
    cep: local[4],
  };
}

// Tabelas de PREÇOS do contrato LUSO. Cada linha de item é:
//   <Solução> <Tipo de Medida> <qtde> <vr unit> <total s/ desc> <desconto> <total c/ desc>
// e a seção fecha em "Totalização <total> <desconto> <total c/ desc>".
function leItens(t: string, cabecalho: RegExp, kind: ItemLido["kind"]) {
  const inicio = t.search(cabecalho);
  if (inicio < 0) return { itens: [] as ItemLido[], total: null as number | null };

  const trecho = t.slice(inicio);
  const fim = trecho.search(/Totaliza[çc][ãa]o/i);
  const corpo = fim < 0 ? trecho : trecho.slice(0, fim);

  const itens: ItemLido[] = [];
  const linha = /([A-Za-zÀ-ÿ0-9][^\d]*?)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  for (const m of corpo.matchAll(linha)) {
    // A primeira linha de cada tabela vem grudada no cabeçalho de colunas.
    // O corte é guloso de propósito: interessa o que vem depois do último
    // pedaço de cabeçalho, que é onde começa o nome da solução.
    const prefixo = m[1].replace(/^.*(?:com Desconto|do Item|da Medida)\s*/i, "").trim();
    if (!prefixo) continue;
    // O prefixo junta solução e tipo de medida ("Teknisa TecFood Filial
    // TecFood"). A medida começa por uma palavra conhecida do catálogo; se não
    // reconhecer, guarda tudo como solução em vez de cortar no lugar errado.
    const corte = prefixo.match(
      /^(.*?)\s+((?:Filial|Unidade|Usuário|Usuario|Loja|Ponto|Terminal|Licen[çc]a)\b.*)$/i
    );
    itens.push({
      kind,
      solucao: (corte ? corte[1] : prefixo).trim(),
      tipoMedida: corte ? corte[2].trim() : null,
      qtde: parseInt(m[2], 10),
      valorUnit: valorBr(m[3]),
      desconto: valorBr(m[5]),
      valorTotal: valorBr(m[6]),
    });
  }

  const tot = trecho.match(/Totaliza[çc][ãa]o\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/i);
  return { itens, total: valorBr(tot?.[3]) };
}

export async function lerContratoAssinado(bytes: Uint8Array): Promise<LeituraContrato> {
  const vazio: LeituraContrato = {
    ok: false,
    razaoSocial: null,
    cnpj: null,
    endereco: null,
    cidade: null,
    uf: null,
    cep: null,
    propostaNumero: null,
    productLine: null,
    dataAssinatura: null,
    contatoTeknisa: null,
    contratos: [],
    camposNaoLidos: [],
  };

  let t: string;
  let capa: string[];
  try {
    const lido = await textoDoPdf(bytes);
    t = lido.inteiro;
    capa = lido.capa;
  } catch {
    return { ...vazio, erro: "Não foi possível abrir o PDF. Confira se o arquivo não está corrompido." };
  }

  if (t.length < 500) {
    return {
      ...vazio,
      erro:
        "Este PDF não tem texto para ler, parece ser uma imagem ou documento escaneado. Envie o contrato assinado digitalmente pela Certisign, ou preencha o cadastro manualmente.",
    };
  }

  // Números de contrato: SAAS-<AAAAMM><proposta>-<seq> e o LUSO correspondente.
  const numeros = [...new Set(t.match(/(?:SAAS|LUSO)-\d{6}\d+-\d+/g) ?? [])];
  if (numeros.length === 0) {
    return {
      ...vazio,
      erro:
        "Não encontrei um número de contrato Teknisa (SAAS ou LUSO) neste PDF. Confira se é o contrato assinado do cliente.",
    };
  }

  const cliente = leCliente(t);
  const camposNaoLidos: string[] = [];
  if (!cliente) camposNaoLidos.push("dados cadastrais do cliente");

  // O número traz AAAAMM + o número-raiz da proposta.
  const proposta = numeros[0].match(/-(\d{6})(\d+)-/);
  const propostaNumero = proposta ? proposta[2] : null;

  const produto = /Projeto\s+TecFood\s+Express/i.test(t)
    ? ("TECFOOD" as const)
    : /Projeto\s+Retail\s+Express/i.test(t)
      ? ("RETAIL" as const)
      : null;
  if (!produto) camposNaoLidos.push("produto (TecFood ou Retail)");

  // Data de assinatura: a folha da Certisign lista a data de cada assinante.
  // Vale a mais recente, que é quando o contrato ficou completo.
  const datas = (t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [])
    .map(dataBr)
    .filter((d): d is string => !!d)
    .sort();
  const dataAssinatura = datas.length > 0 ? datas[datas.length - 1] : null;
  if (!dataAssinatura) camposNaoLidos.push("data de assinatura");

  const contatoTeknisa = leContatoTeknisa(capa, cliente?.razaoSocial ?? null);
  if (!contatoTeknisa) camposNaoLidos.push("contato comercial da Teknisa");

  // Cláusulas que valem por contrato inteiro (o modelo repete o mesmo valor
  // nos dois instrumentos do par).
  const vig = t.match(/vig[êe]ncia de\s+(\d+)\s*\([^)]*\)\s*meses/i);
  const horas = t.match(/Treinamento:\s*(\d+)\s*\([^)]*\)\s*horas/i);
  const prazo = t.match(
    /Treinamento dever[áa] ser realizado em um prazo de at[ée]\s+(\d+)\s*\([^)]*\)\s*(meses|m[êe]s|dias)/i
  );
  const limite = t.match(/Megabyte\s*\(Limite\)\s*([\d.]+)/i);

  const prazoTreinamentoDias = prazo
    ? /dias/i.test(prazo[2])
      ? parseInt(prazo[1], 10)
      : parseInt(prazo[1], 10) * 30
    : null;
  const horasTreinamento = horas ? parseInt(horas[1], 10) : null;
  if (!horasTreinamento) camposNaoLidos.push("horas de treinamento");
  if (!prazoTreinamentoDias) camposNaoLidos.push("prazo do treinamento");

  const licenca = leItens(t, /Licen[çc]a de Uso\s+\w+\s+Express/i, "LICENCA");
  const manutencao = leItens(t, /Manuten[çc][ãa]o?o?\s+\w+\s+Express/i, "MANUTENCAO");
  if (licenca.itens.length === 0 && manutencao.itens.length === 0) {
    camposNaoLidos.push("soluções e valores contratados");
  }

  const contratos: ContratoLido[] = numeros.map((numero) => {
    const kind = numero.startsWith("SAAS") ? ("SAAS" as const) : ("LUSO" as const);
    const ehLuso = kind === "LUSO";
    return {
      kind,
      numero,
      vigenciaMeses: vig ? parseInt(vig[1], 10) : null,
      // Licença, manutenção e treinamento vivem no LUSO; o limite de base é do
      // SAAS. Separar aqui evita duplicar o mesmo dinheiro nos dois contratos.
      valorLicenca: ehLuso ? licenca.total : null,
      valorMensal: ehLuso ? manutencao.total : null,
      horasTreinamento: ehLuso ? horasTreinamento : null,
      prazoTreinamentoDias: ehLuso ? prazoTreinamentoDias : null,
      limiteSaasMb: !ehLuso && limite ? parseInt(limite[1].replace(/\./g, ""), 10) : null,
      itens: ehLuso ? [...licenca.itens, ...manutencao.itens] : [],
    };
  });

  return {
    ok: true,
    razaoSocial: cliente?.razaoSocial ?? null,
    cnpj: cliente?.cnpj ?? null,
    endereco: cliente?.endereco ?? null,
    cidade: cliente?.cidade ?? null,
    uf: cliente?.uf ?? null,
    cep: cliente?.cep ?? null,
    propostaNumero,
    productLine: produto,
    dataAssinatura,
    contatoTeknisa,
    contratos,
    camposNaoLidos,
  };
}
