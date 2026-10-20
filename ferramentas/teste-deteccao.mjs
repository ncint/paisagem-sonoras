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
  // Intensidade: fundo = intenso, topo = suave.
  // Deve convergir para 0.15 + 0.85 * posY ≈ 0.25
  verificar(
    `intensidade no topo converge para ~0.25 (obtido: ${info.intensidade.toFixed(2)})`,
    Math.abs(info.intensidade - (0.15 + 0.85 * info.posY)) < 0.05
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
    `objeto no fundo dá som mais intenso que no topo (${info2.intensidade.toFixed(2)} > ${info.intensidade.toFixed(2)})`,
    info2.intensidade > info.intensidade + 0.4
  );
}

// ---------- 4. Gamas de matiz sem sobreposições ----------

{
  const gamas = Object.values(CORES).flatMap((c) => c.gamas);
  let semSobreposicao = true;
  for (let h = 0; h < 360; h += 1) {
    let pertences = 0;
    for (const [hMin, hMax] of gamas) {
      if (h >= hMin && h <= hMax) pertences++;
    }
    if (pertences > 1) { semSobreposicao = false; break; }
  }
  verificar('gamas de matiz sem sobreposições', semSobreposicao);
}

// ---------- Resumo ----------

if (falhas === 0) {
  console.log('\nTodos os testes passaram.');
  process.exit(0);
} else {
  console.error(`\n${falhas} teste(s) falharam.`);
  process.exit(1);
}
