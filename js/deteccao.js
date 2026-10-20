// deteccao.js — deteção cromática em espaço HSV
// Analisa a imagem em resolução reduzida, agrupa píxeis por matiz (hue)
// e devolve, para cada cor alvo, a presença, a área detetada e a posição
// vertical média do objeto (que controla a intensidade do som).

// Gamas de matiz (graus, 0-360) para cada cor alvo.
// O vermelho está dividido em duas gamas porque o círculo de matizes
// passa por 0 (o vermelho puro fica no limite entre 360 e 0).
// A gama é estreita (até 10°) porque a pele humana tem matiz entre
// ~28° e ~34°: fora da gama do vermelho, a mão é rejeitada pela
// matiz. O satMinExtra acrescenta uma margem de saturação apenas
// para o vermelho (proteção adicional contra tons alaranjados).
export const CORES = {
  vermelho: {
    gamas: [[350, 360], [0, 10]],
    satMinExtra: 0.20,
    nome: 'vermelho',
  },
  verde: {
    gamas: [[85, 160]],
    nome: 'verde',
  },
  azul: {
    gamas: [[190, 255]],
    nome: 'azul',
  },
  amarelo: {
    gamas: [[45, 70]],
    nome: 'amarelo',
  },
  // O preto não tem matiz: é detetado por ser escuro e pouco
  // saturado (ver LIM_PRETO_* em baixo), não por gamas de matiz.
  preto: {
    gamas: [],
    escuro: true,
    nome: 'preto',
  },
};

// Converte RGB (0-255) em HSV (h 0-360, s 0-1, v 0-1).
// Versão inline, sem alocações, para manter a análise rápida.
function rgbParaHsv(r, g, b) {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;
  let h = 0;
  if (d > 0.00001) {
    if (max === rN) h = 60 * (((gN - bN) / d) % 6);
    else if (max === gN) h = 60 * (((bN - rN) / d) + 2);
    else h = 60 * (((rN - gN) / d) + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h, s, v];
}

export class DeteccaoCores {
  constructor(larguraAnalise = 160) {
    this.largura = larguraAnalise;
    this.canvas = null;
    this.ctx = null;
    // Estado por cor: contadores de frames para histerese
    // Estado por cor, gerado a partir de CORES: acrescentar uma cor
    // nova em CORES basta para que o estado a acompanhe.
    this.framesAtivo = {};
    this.presente = {};
    this.intensidade = {};
    for (const chave of Object.keys(CORES)) {
      this.framesAtivo[chave] = 0;
      this.presente[chave] = false;
      this.intensidade[chave] = 0;
    }
  }

  // sensibilidade: 0.01 (pouco sensível) a 1 (muito sensível).
  // Afeta o limiar de saturação e a fração mínima de área detetada.
  analisar(video, sensibilidade) {
    const altura = Math.round((video.videoHeight / video.videoWidth) * this.largura);
    if (!video.videoWidth || !altura) return null;
    const alturaAnalise = altura;

    // O canvas só é criado no primeiro uso: evita depender do DOM no
    // construtor e permite testar a lógica de estado fora do navegador.
    if (!this.ctx) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    this.canvas.width = this.largura;
    this.canvas.height = altura;
    this.ctx.drawImage(video, 0, 0, this.largura, altura);
    const dados = this.ctx.getImageData(0, 0, this.largura, altura).data;

    // Limiares derivados da sensibilidade (quanto mais alta, mais permissiva)
    const satMin = 0.35 - 0.25 * sensibilidade;   // 0.10 a 0.35
    const valMin = 0.20;                          // tolera sombras moderadas
    const areaMin = 0.006 - 0.0045 * sensibilidade; // 0.15% a 0.6% da imagem

    const totais = this.largura * altura;
    const resultado = {};
    const contadores = {};
    const somaX = {};
    const somaY = {};

    // Lista de [chave, gamas, limiarExtra] pré-computada uma única vez
    if (!this._alvos) {
      this._alvos = Object.entries(CORES)
        .filter(([, def]) => !def.escuro)
        .map(([chave, def]) => [chave, def.gamas, def.satMinExtra || 0]);
      this._chavesEscuras = Object.entries(CORES)
        .filter(([, def]) => def.escuro)
        .map(([chave]) => chave);
    }

    for (const [chave] of this._alvos) {
      contadores[chave] = 0;
      somaX[chave] = 0;
      somaY[chave] = 0;
    }
    for (const chave of this._chavesEscuras) {
      contadores[chave] = 0;
      somaX[chave] = 0;
      somaY[chave] = 0;
    }

    // Limiares do preto. Testado ANTES da classificação por matiz:
    // um píxel escuro (V baixo) deve contar para o preto mesmo que
    // a sua matiz fosse de outra cor — objetos coloridos reais têm
    // V muito acima (azuis vivos: V ~0,7-0,9). A saturação só limita
    // para não capturar tons escuros ainda claramente coloridos.
    const LIM_PRETO_VAL = 0.38;
    const LIM_PRETO_SAT = 0.60;

    const alvos = this._alvos;
    const escuras = this._chavesEscuras;
    for (let i = 0; i < dados.length; i += 4) {
      const [h, s, v] = rgbParaHsv(dados[i], dados[i + 1], dados[i + 2]);

      // Preto: escuro e pouco saturado, antes de qualquer teste de matiz
      if (escuras.length > 0 && v < LIM_PRETO_VAL && s < LIM_PRETO_SAT) {
        const chave = escuras[0];
        contadores[chave]++;
        const pixel = (i / 4) % this.largura;
        somaX[chave] += pixel;
        somaY[chave] += Math.floor((i / 4) / this.largura);
        continue;
      }

      if (s < satMin || v < valMin) continue;
      for (let a = 0; a < alvos.length; a++) {
        // Cores com satMinExtra exigem saturação adicional (ex.: o vermelho,
        // para não confundir a pele humana com um objeto vermelho)
        if (s < satMin + alvos[a][2]) continue;
        const gamas = alvos[a][1];
        for (let g = 0; g < gamas.length; g++) {
          if (h >= gamas[g][0] && h <= gamas[g][1]) {
            const chave = alvos[a][0];
            contadores[chave]++;
            const pixel = (i / 4) % this.largura;
            somaX[chave] += pixel;
            somaY[chave] += Math.floor((i / 4) / this.largura);
            break;
          }
        }
      }
    }

    const FRENTE_ATIVACAO = 3;    // frames consecutivos para ligar
    const FRENTE_DESATIVACAO = 8; // frames para desligar (também o teto do contador)

    for (const chave of Object.keys(CORES)) {
      const fracArea = contadores[chave] / totais;
      let destino;
      if (this.presente[chave]) {
        // Histerese: para desligar exige área claramente abaixo do limiar
        destino = fracArea > areaMin * 0.55;
      } else {
        destino = fracArea > areaMin;
      }

      // O contador fica limitado a FRENTE_DESATIVACAO para que a
      // desativação demore sempre o mesmo número de frames, esteja o
      // objeto presente há um segundo ou há um minuto.
      this.framesAtivo[chave] = destino
        ? Math.min(this.framesAtivo[chave] + 1, FRENTE_DESATIVACAO)
        : Math.max(this.framesAtivo[chave] - 1, 0);

      if (!this.presente[chave] && this.framesAtivo[chave] >= FRENTE_ATIVACAO) {
        this.presente[chave] = true;
      } else if (this.presente[chave] && this.framesAtivo[chave] === 0) {
        this.presente[chave] = false;
      }

      // Posições médias (0 = topo/esquerda, 1 = fundo/direita)
      let posX = null;
      let posY = null;
      if (contadores[chave] > 0) {
        posX = (somaX[chave] / contadores[chave]) / this.largura;
        posY = (somaY[chave] / contadores[chave]) / alturaAnalise;
      }

      // Intensidade alvo: mapeia a posição VERTICAL em volume relativo.
      // Topo da imagem = mais intenso; fundo da imagem = mais suave.
      const alvo = this.presente[chave] && posY !== null
        ? 0.15 + 0.85 * (1 - Math.min(1, Math.max(0, posY)))
        : 0;

      // Suavização exponencial para evitar oscilações rápidas
      const alfa = this.presente[chave] ? 0.18 : 0.08;
      this.intensidade[chave] += alfa * (alvo - this.intensidade[chave]);

      resultado[chave] = {
        presente: this.presente[chave],
        area: fracArea,
        posX,
        posY,
        intensidade: this.intensidade[chave],
      };
    }

    return {
      largura: this.largura,
      altura,
      cores: resultado,
      satMin,
      areaMin,
    };
  }
}
