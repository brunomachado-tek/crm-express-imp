// Documento PDF de acompanhamento do cliente, gerado no SERVIDOR (@react-pdf).
// Trocamos a impressão do navegador por isto porque o "Salvar como PDF" do
// Safari saía em branco. Aqui o arquivo é determinístico e igual em qualquer
// navegador. Fontes de marca (Roboto/Poppins) e logo vetorial ficam fiéis.
//
// Fica em .mjs (React.createElement, sem JSX) para rodar tanto na rota Next
// quanto num script de teste com node puro.

import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Path, Font } from "@react-pdf/renderer";
import path from "node:path";

const h = React.createElement;

// ── Fontes de marca (arquivos versionados em src/pdf/fonts) ──
// Caminho a partir do cwd (raiz do projeto), que o outputFileTracingIncludes
// preserva no bundle serverless. Mais confiável que import.meta.url, que aponta
// para o chunk empacotado (onde os .ttf não ficam).
let fontesRegistradas = false;
function registrarFontes() {
  if (fontesRegistradas) return;
  const f = (nome) => path.join(process.cwd(), "src", "pdf", "fonts", nome);
  Font.register({
    family: "Roboto",
    fonts: [
      { src: f("roboto-400.ttf"), fontWeight: 400 },
      { src: f("roboto-500.ttf"), fontWeight: 500 },
      { src: f("roboto-700.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Poppins",
    fonts: [
      { src: f("poppins-600.ttf"), fontWeight: 600 },
      { src: f("poppins-700.ttf"), fontWeight: 700 },
    ],
  });
  // nomes próprios não devem ser hifenizados no meio
  Font.registerHyphenationCallback((w) => [w]);
  fontesRegistradas = true;
}

// ── Cores da marca (mesmas do sistema) ──
const COR = {
  primary: "#040486",
  foreground: "#273138",
  muted: "#e8eef7",
  mutedFg: "#64748b",
  border: "#dde5f0",
  tecfood: "#0051d0",
  retail: "#059e1e",
  white: "#ffffff",
};

const estilos = StyleSheet.create({
  page: { paddingVertical: 32, paddingHorizontal: 34, fontFamily: "Roboto", fontSize: 10, color: COR.foreground, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, paddingBottom: 14 },
  sub: { fontSize: 9, color: COR.mutedFg, marginTop: 6 },
  docTitle: { fontFamily: "Poppins", fontWeight: 600, fontSize: 15, color: COR.primary },
  docProd: { fontSize: 11, fontWeight: 500, marginTop: 3 },
  docDate: { fontSize: 9, color: COR.mutedFg, marginTop: 3 },
  right: { textAlign: "right", maxWidth: 300 },
  cliente: { marginTop: 16 },
  clienteNome: { fontFamily: "Poppins", fontWeight: 600, fontSize: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  infoItem: { width: "50%", marginBottom: 5, paddingRight: 12 },
  rot: { fontSize: 8, color: COR.mutedFg, textTransform: "uppercase", letterSpacing: 0.3 },
  val: { fontSize: 10, fontWeight: 500 },
  chip: { marginTop: 14, backgroundColor: COR.muted, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 10, alignSelf: "flex-start", flexDirection: "row" },
  grupo: { marginTop: 18 },
  grupoNome: { fontFamily: "Poppins", fontWeight: 600, fontSize: 12, borderLeftWidth: 3, paddingLeft: 8 },
  item: { borderWidth: 1, borderColor: COR.border, borderRadius: 5, padding: 10, marginTop: 8 },
  itemTitulo: { fontSize: 11, fontWeight: 500 },
  desc: { fontSize: 10, color: COR.mutedFg, marginTop: 4 },
  campos: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  campo: { width: "33.33%", marginBottom: 6, paddingRight: 8 },
  obs: { marginTop: 8, backgroundColor: COR.muted, borderRadius: 5, padding: 8 },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, borderTopWidth: 1, borderTopColor: COR.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerTxt: { fontSize: 9, color: COR.mutedFg },
});

// Logo Teknisa (mesmo SVG de public/brand/teknisa.svg), vetorial no PDF.
function LogoTeknisa() {
  const P = (d, fill) => h(Path, { d, fill });
  return h(
    Svg,
    { viewBox: "0 0 511 97", style: { width: 132, height: 25 } },
    P("M474.331 44.9824C479.275 44.9824 483.282 40.9873 483.282 36.059C483.282 31.1292 479.275 27.1342 474.331 27.1342C469.402 27.1342 465.389 31.1292 465.389 36.059C465.389 40.9873 469.402 44.9824 474.331 44.9824Z", "#F4B800"),
    P("M474.332 72.062C479.523 72.062 483.735 67.8622 483.735 62.6886C483.735 57.5026 479.522 53.3027 474.332 53.3027C469.146 53.3027 464.934 57.504 464.934 62.6886C464.934 67.8622 469.146 72.062 474.332 72.062Z", "#F4B800"),
    P("M492.073 9.37894C492.073 14.5567 496.283 18.7621 501.47 18.7621C506.67 18.7621 510.868 14.5553 510.868 9.37894C510.868 4.20541 506.669 0 501.47 0C496.283 0 492.073 4.2068 492.073 9.37894Z", "#040486"),
    P("M464.934 9.37894C464.934 14.5567 469.144 18.7621 474.332 18.7621C479.532 18.7621 483.735 14.5553 483.735 9.37894C483.735 4.20541 479.53 0 474.332 0C469.143 0 464.934 4.2068 464.934 9.37894Z", "#059E1E"),
    P("M437.801 9.37894C437.801 14.5567 441.998 18.7621 447.199 18.7621C452.388 18.7621 456.597 14.5553 456.597 9.37894C456.597 4.20541 452.386 0 447.199 0C441.998 0 437.801 4.2068 437.801 9.37894Z", "#040486"),
    P("M140.37 96.3956V38.3877H155.798V59.4612L180.58 38.3877H202.3L170.862 65.711L206.771 96.3956H183.774L155.798 72.3382V96.3956H140.37Z", "#040486"),
    P("M289.633 96.4016V38.5769H305.129L305.183 96.4016H289.633Z", "#040486"),
    P("M133.358 38.5769L133.358 51.6968H88.5L88.5 60.4434H114.087L114.083 72.3485H88.5L88.5 83.5247H133.358L133.355 96.5848H73.9634V38.5769H133.358Z", "#040486"),
    P("M279.651 38.3944H264.325V73.806L224.074 38.3944H211.827V96.4023H227.308V60.929L267.153 96.4023H279.651V38.3944Z", "#040486"),
    P("M0 38.5769H67.1454V51.6968H41.0604V96.5848L25.5109 96.614V51.726L0 51.6968V38.5769Z", "#040486"),
    P("M428.094 38.5769H412.788L379.502 96.5848L396.061 96.5867L403.009 85.2273L438.299 85.2254L445.115 96.5848H461.623L428.094 38.5769ZM408.657 72.1074L421.598 50.0222L419.756 49.6539L432.502 72.1487L408.657 72.1074Z", "#040486"),
    P("M378.2 54.8554H362.739C362.722 53.5223 362.711 54.7893 362.709 53.4507C362.708 52.112 361.799 51.7039 360.986 51.7039H333.563C332.158 51.7039 331.332 52.9325 331.332 53.824V59.5051C331.332 61.4956 332.908 61.4956 333.826 61.4956H365.262H366.214C378.2 61.4956 378.2 69.0934 378.2 73.4492V86.5904C378.2 90.8919 378.2 96.4039 369.32 96.4039H327.71C318.467 96.4039 315.8 91.1268 315.8 83.1938V80.1234H331.369V81.3941C331.369 81.6044 331.369 83.205 333.826 83.205H360.991C362.194 83.205 362.491 82.5416 362.439 81.3941L362.44 74.6258C362.44 73.6449 361.975 73.3483 361.107 73.3483H327.754C324.07 73.3483 315.801 73.4293 315.801 63.2434V47.7498C315.801 41.3658 319.302 38.3877 324.84 38.3877H366.632C372.944 38.3877 378.201 41.2251 378.201 47.7428V54.8554H378.2Z", "#040486"),
  );
}

function Info(rotulo, valor) {
  return h(View, { style: estilos.infoItem, key: rotulo }, h(Text, { style: estilos.rot }, rotulo), h(Text, { style: estilos.val }, valor));
}

// data = { cliente:{razaoSocial,cnpj,local}, produtoLabel, cor, consultor,
//   etapa, contrato, assinatura, geradoEm, total, blocos, grupos:[{nome,items:[
//   {titulo, descricao, pautas, observacao, campos:[{rotulo,valor}]}]}] }
export function AcompanhamentoDoc(data) {
  registrarFontes();
  const cor = data.cor;

  const cabecalho = h(
    View,
    { style: [estilos.header, { borderBottomColor: cor }] },
    h(View, null, h(LogoTeknisa), h(Text, { style: estilos.sub }, "CRM Express · Small Business")),
    h(
      View,
      { style: estilos.right },
      h(Text, { style: estilos.docTitle }, "Acompanhamento de Implantação"),
      h(Text, { style: [estilos.docProd, { color: cor }] }, data.produtoLabel),
      h(Text, { style: estilos.docDate }, `Gerado em ${data.geradoEm}`),
    ),
  );

  const infos = [];
  if (data.cliente.cnpj) infos.push(Info("CNPJ", data.cliente.cnpj));
  if (data.cliente.local) infos.push(Info("Cidade / UF", data.cliente.local));
  infos.push(Info("Consultor responsável", data.consultor));
  infos.push(Info("Etapa atual", data.etapa));
  if (data.contrato) infos.push(Info("Contrato", data.contrato));
  if (data.assinatura) infos.push(Info("Assinatura", data.assinatura));

  const clienteBloco = h(
    View,
    { style: estilos.cliente },
    h(Text, { style: estilos.clienteNome }, data.cliente.razaoSocial),
    h(View, { style: estilos.grid }, ...infos),
    h(
      View,
      { style: estilos.chip },
      h(Text, { style: { fontWeight: 500 } }, `${data.total} `),
      h(Text, { style: { color: COR.mutedFg } }, `atividades planejadas em ${data.blocos} bloco${data.blocos === 1 ? "" : "s"}`),
    ),
  );

  const grupos = data.grupos.map((g, gi) =>
    h(
      View,
      { style: estilos.grupo, key: `g${gi}`, wrap: false },
      h(Text, { style: [estilos.grupoNome, { borderLeftColor: cor }] }, g.nome),
      ...g.items.map((a, ai) =>
        h(
          View,
          { style: estilos.item, key: `a${gi}-${ai}`, wrap: false },
          h(Text, { style: estilos.itemTitulo }, a.titulo),
          a.descricao ? h(Text, { style: estilos.desc }, a.descricao) : null,
          a.pautas
            ? h(Text, { style: estilos.desc }, [
                h(Text, { key: "l", style: { color: COR.foreground, fontWeight: 500 } }, "Pautas: "),
                a.pautas,
              ])
            : null,
          a.campos.length
            ? h(
                View,
                { style: estilos.campos },
                ...a.campos.map((c, ci) =>
                  h(View, { style: estilos.campo, key: `c${ci}` }, h(Text, { style: estilos.rot }, c.rotulo), h(Text, { style: estilos.val }, c.valor)),
                ),
              )
            : null,
          a.observacao
            ? h(Text, { style: estilos.obs }, [
                h(Text, { key: "l", style: { fontWeight: 500 } }, "Observação: "),
                h(Text, { key: "v", style: { color: COR.mutedFg } }, a.observacao),
              ])
            : null,
        ),
      ),
    ),
  );

  const rodape = h(
    View,
    { style: estilos.footer, fixed: true },
    h(Text, { style: estilos.footerTxt }, "Documento gerado pelo CRM Express · Teknisa Small Business"),
    h(Text, { style: estilos.footerTxt }, data.geradoEm),
  );

  return h(
    Document,
    null,
    h(Page, { size: "A4", style: estilos.page }, cabecalho, clienteBloco, ...grupos, rodape),
  );
}
