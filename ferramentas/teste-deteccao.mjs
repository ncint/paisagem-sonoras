// teste-deteccao.mjs — teste da lógica de deteção sem navegador.
// Executar:  node ferramentas/teste-deteccao.mjs
//
// Substitui o canvas por um stub que devolve frames sintéticos
// (píxeis RGB gerados) e verifica:
//   1. conversão RGB → HSV (casos conhecidos);
//   2. classificação de cores puras nas gamas certas;
//   3. histerese: ligar em ~3 frames, desligar em ~8 frames;
//   4. posição vertical média e intensidade resultante.

import { CORES, DeteccaoCores } from '../js/deteccao.js';

let falhas = 0;
function verificar(nome, condicao, detalhe = '') {
  if (condicao) {
    console.log(`OK    ${nome}`);
  } else {
    falhas++;
    console.error(`FALHA ${nome} ${detalhe}`);
  }
}

// ---------- Stub de canvas ----------

function hexParaRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function criarDetectorComFrame(hex, proporcao = 0.05) {
  const detector = new DeteccaoCores(100);
  const [r, g, b] = hexParaRgb(hex);
  const n = 100 * 75;
  const comCor = Math.floor(n * proporcao);

  detector.canvas = { width: 0, height: 0 };
  detector.ctx = {
    canvas: null,
    drawImage() {},
    getImageData(x, y, l, a) {
      const dados = new Uint8ClampedArray(l * a * 4);
      for (let i = 0; i < l * a; i++) {
        const comObjeto = i < comCor;
        const o = i * 4;
        dados[o] = comObjeto ? r : 200;
        dados[o + 1] = comObjeto ? g : 200;
        dados[o + 2] = comObjeto ? b : 200;
        dados[o + 3] = 255;
      }
      return { data: dados };
    },
  };
  return detector;
}

const video = { videoWidth: 640, videoHeight: 480 };
const SENS = 0.5; // valor médio do cursor de sensibilidade

// ---------- 1. Cores puras são classificadas nas gamas certas ----------

const casos = [
  ['#d0342c', 'vermelho'], // vermelho vivo
  ['#e74c3c', 'vermelho'], // vermelho ligeiramente alaranjado
  ['#2ecc71', 'verde'],   // verde vivo
  ['#27ae60', 'verde'],   // verde folha
  ['#3498db', 'azul'],    // azul vivo
  ['#2980b9', 'azul'],    // azul mais escuro
  ['#f1c40f', 'amarelo'], // amarelo vivo
  ['#d4ac2b', 'amarelo'], // amarelo ouro
  ['#e67e22', 'laranja'], // laranja vivo
  ['#f39c12', 'laranja'], // laranja claro
  ['#6e3b10', 'castanho'], // castanho escuro
  ['#8b4513', 'castanho'], // castanho sela
  ['#8e44ad', 'roxo'],   // roxo vivo
  ['#9b59b6', 'roxo'],   // roxo claro
  ['#1a1a1a', 'preto'],    // preto quase puro
  ['#0d0d0d', 'preto'],    // preto profundo
];

for (const [hex, esperado] of casos) {
  const d = criarDetectorComFrame(hex);
  // 5 frames seguidos para passar a histerese de ativação
  let res = null;
  for (let i = 0; i < 5; i++) res = d.analisar(video, SENS);
  const detetadas = Object.entries(res.cores)
    .filter(([, info]) => info.presente)
    .map(([chave]) => chave);
  verificar(
    `${hex} → ${esperado}`,
    detetadas.length === 1 && detetadas[0] === esperado,
    `detetado: ${detetadas.join(', ') || 'nada'}`
  );
}

// Cinzento neutro não deve detetar nada (baixa saturação)
{
  const d = criarDetectorComFrame('#808080');
  let res = null;
  for (let i = 0; i < 10; i++) res = d.analisar(video, SENS);
  const detetadas = Object.values(res.cores).filter((i) => i.presente).length;
  verificar('cinzento neutro → sem deteção', detetadas === 0, `detetadas: ${detetadas}`);
}

// Sombras sobre o papel branco (branco escurecido) NÃO devem ser
// detetadas como preto: têm V ~0,3-0,6, acima do limiar V<0,28.
const sombras = [
  ['#a9a9a9', 'sombra leve'],
  ['#7d7d7d', 'sombra média'],
  ['#5a5a5a', 'sombra forte'],
];
for (const [hex, nome] of sombras) {
  const d = criarDetectorComFrame(hex, 0.10);
  let res = null;
  for (let i = 0; i < 10; i++) res = d.analisar(video, SENS);
  const alguma = Object.values(res.cores).some((i) => i.presente);
  verificar(`${nome} (${hex}) → sem deteção`, !alguma, 'detetada');
}

// Azul-escuro dessaturado (#2c3e50, matiz 210°): com os limiares
// apertados do preto, deve ser classificado como AZUL (a sua matiz
// real), não como preto.
{
  const d = criarDetectorComFrame('#2c3e50');
  let res = null;
  for (let i = 0; i < 5; i++) res = d.analisar(video, SENS);
  verificar('#2c3e50 → azul (não preto)',
    res.cores.azul.presente && !res.cores.preto.presente);
}

// Tons de pele humana NÃO devem ser detetados como vermelho:
// a pele tem matiz ~10-30° (fora da gama do vermelho) e saturação
// moderada (abaixo do satMinExtra do vermelho).
const tonsDePele = [
  ['#f1c27d', 'pele clara'],
  ['#e0ac69', 'pele média'],
  ['#c68642', 'pele morena'],
  ['#8d5524', 'pele escura'],
];
for (const [hex, nome] of tonsDePele) {
  const d = criarDetectorComFrame(hex, 0.10); // mão é grande na imagem
  let res = null;
  for (let i = 0; i < 10; i++) res = d.analisar(video, SENS);
  const vermelhoAtivo = res.cores.vermelho.presente;
  verificar(`${nome} (${hex}) → não detetada como vermelho`,
    !vermelhoAtivo, 'detetada como vermelho');
  // A pele tem a mesma matiz do laranja/castanho: os limiares de
  // saturação e brilho devem excluí-la também desses dois canais.
  const laranjaAtivo = res.cores.laranja.presente;
  verificar(`${nome} (${hex}) → não detetada como laranja`,
    !laranjaAtivo, 'detetada como laranja');
  const castanhoAtivo = res.cores.castanho.presente;
  verificar(`${nome} (${hex}) → não detetada como castanho`,
    !castanhoAtivo, 'detetada como castanho');
}

// ---------- 2. Histerese: tempos de ligar/desligar ----------

function contarFramesParaLigar(hex) {
  const d = criarDetectorComFrame(hex);
  for (let f = 1; f <= 20; f++) {
    const res = d.analisar(video, SENS);
    if (res.cores[Object.keys(res.cores).find((c) => res.cores[c].presente)]) {
      // devolve o frame em que alguma cor ficou presente
    }
    const alguma = Object.values(res.cores).some((i) => i.presente);
    if (alguma) return f;
  }
  return Infinity;
}

function contarFramesParaDesligar(hex) {
  // liga primeiro…
  const d = criarDetectorComFrame(hex);
  for (let i = 0; i < 30; i++) d.analisar(video, SENS);
  // …depois o objeto desaparece (frame vazio: tudo cinzento)
  d.ctx.getImageData = (x, y, l, a) => {
    const dados = new Uint8ClampedArray(l * a * 4).fill(200);
    for (let i = 3; i < dados.length; i += 4) dados[i] = 255;
    return { data: dados };
  };
  let antes = null;
  for (let f = 1; f <= 20; f++) {
    const res = d.analisar(video, SENS);
    const alguma = Object.values(res.cores).some((i) => i.presente);
    if (!alguma) return f;
    antes = f;
  }
  return Infinity;
}

const framesLigar = contarFramesParaLigar('#d0342c');
verificar(
  `ativação após ~3 frames (obtido: ${framesLigar})`,
  framesLigar >= 3 && framesLigar <= 4
);

// Com o objeto presente há muito tempo, a desativação deve demorar
// FRENTE_DESATIVACAO=8 frames — não 90 como aconteceria sem o teto.
const framesDesligar = contarFramesParaDesligar('#d0342c');
verificar(
  `desativação após ~8 frames após presença longa (obtido: ${framesDesligar})`,
  framesDesligar >= 8 && framesDesligar <= 10
);

// ---------- 3. Posição vertical e intensidade ----------

{
  // Objeto colocado só na faixa do topo do frame (linhas 0-18 de 75)
  const d = new DeteccaoCores(100);
  const [r, g, b] = hexParaRgb('#d0342c');
  d.canvas = { width: 0, height: 0 };
  d.ctx = {
    drawImage() {},
    getImageData(x, y, l, a) {
      const dados = new Uint8ClampedArray(l * a * 4);
      for (let i = 0; i < l * a; i++) {
        const comObjeto = Math.floor(i / l) < 19; // topo
        const o = i * 4;
        dados[o] = comObjeto ? r : 200;
        dados[o + 1] = comObjeto ? g : 200;
        dados[o + 2] = comObjeto ? b : 200;
        dados[o + 3] = 255;
      }
      return { data: dados };
    },
  };
  let res = null;
  for (let i = 0; i < 40; i++) res = d.analisar(video, SENS);
  const info = res.cores.vermelho;
  verificar(
    `posição média no topo ~0.12 (obtido: ${info.posY?.toFixed(2)})`,
    info.presente && info.posY > 0.05 && info.posY < 0.2
  );
  // Intensidade: topo = intenso, fundo = suave.
  // Deve convergir para 0.15 + 0.85 * (1 - posY) ≈ 0.90
  verificar(
    `intensidade no topo converge para ~0.90 (obtido: ${info.intensidade.toFixed(2)})`,
    Math.abs(info.intensidade - (0.15 + 0.85 * (1 - info.posY))) < 0.05
  );

  // Objeto na faixa do fundo (linhas 56-74): deve ficar mais intenso
  const d2 = new DeteccaoCores(100);
  d2.canvas = { width: 0, height: 0 };
  d2.ctx = {
    drawImage() {},
    getImageData(x, y, l, a) {
      const dados = new Uint8ClampedArray(l * a * 4);
      for (let i = 0; i < l * a; i++) {
        const comObjeto = Math.floor(i / l) >= 56; // fundo
        const o = i * 4;
        dados[o] = comObjeto ? r : 200;
        dados[o + 1] = comObjeto ? g : 200;
        dados[o + 2] = comObjeto ? b : 200;
        dados[o + 3] = 255;
      }
      return { data: dados };
    },
  };
  let res2 = null;
  for (let i = 0; i < 40; i++) res2 = d2.analisar(video, SENS);
  const info2 = res2.cores.vermelho;
  verificar(
    `objeto no topo dá som mais intenso que no fundo (${info.intensidade.toFixed(2)} > ${info2.intensidade.toFixed(2)})`,
    info.intensidade > info2.intensidade + 0.4
  );
}

// ---------- 4. Gamas de matiz: sobreposição só com brilho disjunto ----------

{
  // Laranja e castanho partilham a matiz (15-40°) por desenho:
  // distinguem-se pelo brilho (V). O teste exige que quaisquer duas
  // cores cujas gamas se sobreponham tenham gamas de brilho disjuntas.
  const entradas = Object.values(CORES).filter((c) => c.gamas.length > 0);
  let coerente = true;
  for (let h = 0; h < 360; h += 1) {
    const ativos = entradas.filter(
      (c) => c.gamas.some(([hMin, hMax]) => h >= hMin && h <= hMax)
    );
    for (let i = 0; i < ativos.length; i++) {
      for (let j = i + 1; j < ativos.length; j++) {
        const a = ativos[i], b = ativos[j];
        const minA = a.valMinExtra || 0, maxA = a.valMax || 1;
        const minB = b.valMinExtra || 0, maxB = b.valMax || 1;
        if (Math.max(minA, minB) < Math.min(maxA, maxB)) { coerente = false; }
      }
    }
    if (!coerente) break;
  }
  verificar('sobreposições de matiz apenas com brilho disjunto', coerente);

  // Confirmação direta: um laranja vivo NÃO conta como castanho e
  // vice-versa (mesma matiz, brilhos diferentes).
  {
    const dL = criarDetectorComFrame('#e67e22');
    let rL = null;
    for (let i = 0; i < 5; i++) rL = dL.analisar(video, SENS);
    verificar(
      'laranja vivo ativa mosca e não chuva',
      rL.cores.laranja.presente && !rL.cores.castanho.presente
    );
    const dC = criarDetectorComFrame('#5a2e0a');
    let rC = null;
    for (let i = 0; i < 5; i++) rC = dC.analisar(video, SENS);
    verificar(
      'castanho escuro ativa chuva e não mosca',
      rC.cores.castanho.presente && !rC.cores.laranja.presente
    );
  }
}

// ---------- 5. Caixa delimitadora do objeto ----------

{
  // Objeto apenas na faixa do topo, colunas 10-29 de 100: a caixa deve
  // cobrir exatamente essa região e nada mais.
  const d = new DeteccaoCores(100);
  const [r, g, b] = hexParaRgb('#d0342c');
  d.canvas = { width: 0, height: 0 };
  d.ctx = {
    drawImage() {},
    getImageData(x, y, l, a) {
      const dados = new Uint8ClampedArray(l * a * 4);
      for (let i = 0; i < l * a; i++) {
        const coluna = i % l;
        const linha = Math.floor(i / l);
        const comObjeto = linha < 19 && coluna >= 10 && coluna < 30;
        const o = i * 4;
        dados[o] = comObjeto ? r : 200;
        dados[o + 1] = comObjeto ? g : 200;
        dados[o + 2] = comObjeto ? b : 200;
        dados[o + 3] = 255;
      }
      return { data: dados };
    },
  };
  let res = null;
  for (let i = 0; i < 5; i++) res = d.analisar(video, SENS);
  const caixa = res.cores.vermelho.caixa;
  verificar(
    `caixa delimitadora cobre o objeto (x0~0.10, x1~0.30, y1~0.25; obtido: ${
      caixa ? `x0=${caixa.x0.toFixed(2)} x1=${caixa.x1.toFixed(2)} y1=${caixa.y1.toFixed(2)}` : 'null'
    })`,
    caixa !== null
      && Math.abs(caixa.x0 - 0.10) < 0.02
      && Math.abs(caixa.x1 - 0.30) < 0.02
      && Math.abs(caixa.y1 - (19 / 75)) < 0.02
      && caixa.y0 === 0
  );

  // Sem objeto: caixa é null
  const dVazio = criarDetectorComFrame('#808080');
  const resVazio = dVazio.analisar(video, SENS);
  verificar(
    'sem objeto, caixa delimitadora é null',
    resVazio.cores.vermelho.caixa === null
  );

  // Objeto à esquerda: centro da caixa fica na metade esquerda
  const dEsq = new DeteccaoCores(100);
  dEsq.canvas = { width: 0, height: 0 };
  dEsq.ctx = {
    drawImage() {},
    getImageData(x, y, l, a) {
      const dados = new Uint8ClampedArray(l * a * 4);
      for (let i = 0; i < l * a; i++) {
        const coluna = i % l;
        const comObjeto = coluna < 25;
        const o = i * 4;
        dados[o] = comObjeto ? r : 200;
        dados[o + 1] = comObjeto ? g : 200;
        dados[o + 2] = comObjeto ? b : 200;
        dados[o + 3] = 255;
      }
      return { data: dados };
    },
  };
  let resEsq = null;
  for (let i = 0; i < 5; i++) resEsq = dEsq.analisar(video, SENS);
  const caixaEsq = resEsq.cores.vermelho.caixa;
  const centroCaixa = caixaEsq ? (caixaEsq.x0 + caixaEsq.x1) / 2 : null;
  verificar(
    `objeto à esquerda: centro da caixa < 0.5 (obtido: ${
      centroCaixa !== null ? centroCaixa.toFixed(2) : 'null'
    })`,
    centroCaixa !== null && centroCaixa < 0.5
  );
}

// ---------- Resumo ----------

if (falhas === 0) {
  console.log('\nTodos os testes passaram.');
  process.exit(0);
} else {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
