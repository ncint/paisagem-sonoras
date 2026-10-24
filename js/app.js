// app.js — orquestração principal do instrumento «Paisagens Sonoras»

import { DeteccaoCores } from './deteccao.js';
import { MotorAudio } from './audio.js';

// ---------- Referências ao DOM ----------

const video = document.getElementById('video');
const canvasDetecao = document.getElementById('canvas-deteccao');
const botaoIniciar = document.getElementById('botao-iniciar');
const botaoParar = document.getElementById('botao-parar');
const mensagem = document.getElementById('mensagem');
const volumeGeral = document.getElementById('volume-geral');
const volumeValor = document.getElementById('volume-valor');
const sensibilidadeInput = document.getElementById('sensibilidade');
const sensibilidadeValor = document.getElementById('sensibilidade-valor');
const molduraGuia = document.getElementById('moldura-guia');
const botaoTelaCheia = document.getElementById('botao-tela-cheia');
const painelVideo = document.querySelector('.painel-video');
const preenchimentoVolume = document.getElementById('preenchimento-volume');
const marcadorPan = document.getElementById('marcador-pan');
const seletorCamara = document.getElementById('seletor-camara');

const indicadores = {
  vermelho: document.getElementById('ind-aves'),
  verde: document.getElementById('ind-agua'),
  azul: document.getElementById('ind-vento'),
  amarelo: document.getElementById('ind-grilos'),
  preto: document.getElementById('ind-trovoada'),
  laranja: document.getElementById('ind-mosca'),
  castanho: document.getElementById('ind-chuva'),
  roxo: document.getElementById('ind-cao'),
};

const NOMES_ELEMENTO = {
  vermelho: 'aves',
  verde: 'água',
  azul: 'vento',
  amarelo: 'grilos',
  preto: 'trovoada',
  laranja: 'mosca',
  castanho: 'chuva',
  roxo: 'cão',
};

// ---------- Estado ----------

const deteccao = new DeteccaoCores(160);
const motorAudio = new MotorAudio();
let transmissao = null;   // MediaStream da câmara
let requestHandle = null; // id do loop de animação
let aCorrer = false;
let pedidoId = 0;         // distingue cada clique em «Iniciar»; permite cancelar

// A análise de cor não ganha nada acima de ~30 fps, mas custa CPU em
// cada frame. O loop continua a 60 fps (fluidez do vídeo), mas a
// deteção só corre quando passaram estes ms desde a última análise.
const INTERVALO_ANALISE_MS = 33;
let ultimaAnalise = 0;
let ultimasCores = null; // últimas cores detetadas (para os visualizadores)

function cancelado(id) {
  return id !== pedidoId;
}

// ---------- Seleção de câmara ----------

// Preenche o seletor com as câmaras disponíveis. Só é fiável DEPOIS de
// o utilizador autorizar o acesso (antes da permissão, muitos
// navegadores escondem os identificadores); por isso é chamado no
// arranque e no evento devicechange.
async function atualizarListaCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const cameras = dispositivos.filter((d) => d.kind === 'videoinput');
    const valorAtual = seletorCamara.value;
    seletorCamara.innerHTML = '';
    if (cameras.length === 0) {
      seletorCamara.appendChild(new Option('Nenhuma câmara disponível', ''));
      return;
    }
    for (const [i, cam] of cameras.entries()) {
      const rotulo = cam.label || `Câmara ${i + 1}`;
      seletorCamara.appendChild(new Option(rotulo, cam.deviceId || ''));
    }
    // mantém a seleção atual se a câmara ainda existir
    if ([...seletorCamara.options].some((o) => o.value === valorAtual)) {
      seletorCamara.value = valorAtual;
    }
  } catch (e) {
    // sem permissão ou navegador antigo: o seletor fica com a opção padrão
  }
}

// Troca de câmara «a quente»: substitui a pista de vídeo sem parar o
// áudio nem o loop de deteção. Em telemóveis, o utilizador escolhe
// frontal/traseira pela etiqueta da câmara no seletor.
async function trocarCamara() {
  const deviceId = seletorCamara.value;
  if (!deviceId || !aCorrer) return;
  try {
    const novaTransmissao = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    limparTransmissao();
    transmissao = novaTransmissao;
    video.srcObject = transmissao;
    await video.play();
    definirMensagem('Câmara alterada.');
  } catch (erro) {
    definirMensagem(`Não foi possível usar a câmara escolhida: ${erro.message}`, true);
  }
}

seletorCamara.addEventListener('change', trocarCamara);
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', atualizarListaCameras);
}

// ---------- Ecrã inteiro (para projetar) ----------

// O painel de vídeo (não apenas o <video>) entra em ecrã inteiro:
// assim o canvas das deteções e as barras-guia acompanham.
function alternarTelaCheia() {
  const emEcraInteiro = document.fullscreenElement || document.webkitFullscreenElement;
  if (emEcraInteiro) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    return;
  }
  if (painelVideo.requestFullscreen) {
    painelVideo.requestFullscreen().catch((erro) => {
      definirMensagem(`Não foi possível entrar em ecrã inteiro: ${erro.message}`, true);
    });
  } else if (painelVideo.webkitRequestFullscreen) {
    // Safari antigo
    painelVideo.webkitRequestFullscreen();
  }
}

botaoTelaCheia.addEventListener('click', alternarTelaCheia);

// ---------- Utilitários ----------

function definirMensagem(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.classList.toggle('erro', erro);
}

function atualizarSaidas() {
  volumeValor.textContent = `${volumeGeral.value}%`;
  sensibilidadeValor.textContent = `${sensibilidadeInput.value}%`;
}

// ---------- Desenho das deteções sobre o vídeo ----------

const ctxCanvas = canvasDetecao.getContext('2d');

// Canvas offscreen para desenhar a máscara de uma cor na resolução
// da análise e depois escalá-la sobre o vídeo.
const canvasMascara = document.createElement('canvas');
const ctxMascara = canvasMascara.getContext('2d');

const CORES_MASCARA = {
  vermelho: [201, 79, 61],
  verde: [76, 140, 74],
  azul: [74, 127, 181],
  amarelo: [212, 172, 43],
  preto: [40, 40, 40],
  laranja: [230, 126, 34],
  castanho: [121, 68, 35],
  roxo: [142, 68, 173],
};

function desenharDeteccao(res) {
  const larguraPx = video.clientWidth;
  const alturaPx = video.clientHeight;
  canvasDetecao.width = larguraPx;
  canvasDetecao.height = alturaPx;

  ctxCanvas.clearRect(0, 0, larguraPx, alturaPx);

  // O vídeo usa object-fit: cover, que recorta a imagem se a proporção
  // da câmara não for 4:3. É preciso mapear as posições da imagem
  // original para a área efetivamente visível.
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const escala = Math.max(larguraPx / vw, alturaPx / vh);
  const larguraVisivel = vw * escala;
  const alturaVisivel = vh * escala;
  const offsetX = (larguraPx - larguraVisivel) / 2;
  const offsetY = (alturaPx - alturaVisivel) / 2;

  // 1) Máscaras: píxeis detetados de cada cor, desenhados com a cor
  //    respetiva em semitransparência sobre a imagem.
  canvasMascara.width = res.largura;
  canvasMascara.height = res.altura;
  const dadosMascara = ctxMascara.createImageData(res.largura, res.altura);

  for (const [chave, info] of Object.entries(res.cores)) {
    if (!info.presente) continue;
    const [r, g, b] = CORES_MASCARA[chave];
    const mascara = info.mascara;
    for (let p = 0; p < mascara.length; p++) {
      if (mascara[p] !== 1) continue;
      const o = p * 4;
      dadosMascara.data[o] = r;
      dadosMascara.data[o + 1] = g;
      dadosMascara.data[o + 2] = b;
      dadosMascara.data[o + 3] = 110; // semitransparente
    }
  }

  ctxMascara.putImageData(dadosMascara, 0, 0);
  ctxCanvas.imageSmoothingEnabled = false; // blocos nítidos, sem borrão
  ctxCanvas.drawImage(canvasMascara, offsetX, offsetY, larguraVisivel, alturaVisivel);

  // Desenha uma seta triangular (ponta em (x, y), comprimento len,
  // direção dada por dx/dy normalizados, largura proporcional).
  function desenharSeta(x, y, dx, dy, len, largura, cor) {
    const px = -dy, py = dx; // perpendicular
    const bx = x - dx * len, by = y - dy * len;
    ctxCanvas.beginPath();
    ctxCanvas.moveTo(x, y);
    ctxCanvas.lineTo(bx + px * largura, by + py * largura);
    ctxCanvas.lineTo(bx - px * largura, by - py * largura);
    ctxCanvas.closePath();
    ctxCanvas.fillStyle = cor;
    ctxCanvas.fill();
  }

  for (const [chave, info] of Object.entries(res.cores)) {
    if (!info.presente || !info.caixa) continue;
    const cor = {
      vermelho: 'rgba(201, 79, 61, 0.95)',
      verde: 'rgba(76, 140, 74, 0.95)',
      azul: 'rgba(74, 127, 181, 0.95)',
      amarelo: 'rgba(212, 172, 43, 0.95)',
      preto: 'rgba(20, 20, 20, 0.95)',
      laranja: 'rgba(230, 126, 34, 0.95)',
      castanho: 'rgba(121, 68, 35, 0.95)',
      roxo: 'rgba(142, 68, 173, 0.95)',
    }[chave];
    const corContorno = {
      vermelho: '#c94f3d',
      verde: '#4c8c4a',
      azul: '#4a7fb5',
      amarelo: '#d4ac2b',
      preto: '#141414',
      laranja: '#e67e22',
      castanho: '#794423',
      roxo: '#8e44ad',
    }[chave];

    // Retângulo em volta do objeto detetado (caixa delimitadora da
    // máscara), mapeado para a área visível do vídeo.
    const cx0 = info.caixa.x0 * larguraVisivel + offsetX;
    const cy0 = info.caixa.y0 * alturaVisivel + offsetY;
    const cx1 = info.caixa.x1 * larguraVisivel + offsetX;
    const cy1 = info.caixa.y1 * alturaVisivel + offsetY;
    const centroX = (cx0 + cx1) / 2;
    const centroY = (cy0 + cy1) / 2;

    ctxCanvas.strokeStyle = corContorno;
    ctxCanvas.lineWidth = 3;
    ctxCanvas.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);

    // Visualizador do elemento sobre o vídeo, DENTRO do retângulo do
    // objeto: o mesmo motivo do painel (ondas, pingos, relâmpagos...)
    // ampliado, com fundo escuro semitransparente para se ler sobre
    // qualquer imagem da câmara.
    const escalaVideo = 1.6;
    const visL = LARGURA_VIS * escalaVideo;
    const visA = ALTURA_VIS * escalaVideo;
    const visX = Math.min(Math.max(centroX - visL / 2, offsetX + 6),
      Math.max(larguraPx - visL - 6, offsetX + 6));
    const visY = Math.min(cy1 - visA - 10, Math.max(cy0 + 6, alturaPx - visA - 6));
    ctxCanvas.fillStyle = 'rgba(22, 24, 28, 0.62)';
    ctxCanvas.fillRect(visX, visY, visL, visA);
    desenharMotivo(ctxCanvas, chave, info.intensidade, performance.now() / 1000, escalaVideo);

    // Seta vertical: aponta para CIMA (o volume sobe quando o objeto
    // está mais acima); o comprimento é proporcional à intensidade.
    const lenVol = 18 + 30 * info.intensidade;
    desenharSeta(centroX, cy0 - 8, 0, -1, lenVol, 7, cor);

    // Seta horizontal: aponta para o lado onde o objeto está no campo
    // estéreo (panoramica); esquerda se posX < 0.5, direita se > 0.5.
    const paraDireita = info.posX >= 0.5;
    const lenPan = 14 + 26 * Math.abs(info.posX - 0.5) * 2;
    desenharSeta(
      paraDireita ? cx1 + 8 : cx0 - 8,
      centroY,
      paraDireita ? 1 : -1,
      0,
      lenPan,
      6,
      cor
    );

    // Etiqueta do elemento, junto ao canto superior do retângulo
    ctxCanvas.font = 'bold 16px sans-serif';
    const rotulo = NOMES_ELEMENTO[chave];
    const larguraTexto = ctxCanvas.measureText(rotulo).width;
    const etiqX = Math.min(Math.max(cx0, 8), Math.max(larguraPx - larguraTexto - 16, 8));
    const etiqY = Math.min(Math.max(cy0 - 34, 4), Math.max(alturaPx - 30, 4));
    ctxCanvas.fillStyle = cor;
    ctxCanvas.fillRect(etiqX, etiqY, larguraTexto + 12, 26);
    ctxCanvas.fillStyle = '#fff';
    ctxCanvas.fillText(rotulo, etiqX + 6, etiqY + 19);
  }
}

// ---------- Atualização dos indicadores ----------

function atualizarIndicadores(cores) {
  for (const [chave, info] of Object.entries(cores)) {
    const el = indicadores[chave];
    el.classList.toggle('ativo', info.presente);
    const estadoEl = el.querySelector('.estado');
    estadoEl.textContent = info.presente ? 'ativo' : '—';
  }
}

// ---------- Visualizadores por elemento ----------

// Cada indicador do painel recebe um pequeno canvas com uma animação
// própria do som: ondas (água), pingos (chuva), pássaro (aves), etc.
// A amplitude acompanha a intensidade detetada; sem deteção, a
// animação esvazia até ficar quase parada.
const LARGURA_VIS = 120;
const ALTURA_VIS = 34;

const MOTIVOS = {
  vermelho: 'aves',
  verde: 'agua',
  azul: 'vento',
  amarelo: 'grilos',
  preto: 'trovoada',
  laranja: 'zumbido',
  castanho: 'chuva',
  roxo: 'cao',
};

const CORES_TRAO = {
  vermelho: '#c94f3d',
  verde: '#4c8c4a',
  azul: '#4a7fb5',
  amarelo: '#d4ac2b',
  preto: '#555555',
  laranja: '#e67e22',
  castanho: '#8b5a2b',
  roxo: '#8e44ad',
};

const visualizadores = {};
const visTempo = {};

function criarVisualizadores() {
  for (const [chave, el] of Object.entries(indicadores)) {
    const canvas = document.createElement('canvas');
    canvas.className = 'visualizador';
    canvas.width = LARGURA_VIS;
    canvas.height = ALTURA_VIS;
    canvas.setAttribute('aria-hidden', 'true');
    const acoes = el.querySelector('.acoes');
    el.insertBefore(canvas, acoes);
    visualizadores[chave] = canvas.getContext('2d');
    visTempo[chave] = 0;
  }
}

// Desenha o motivo de um elemento num contexto 2D qualquer, com a
// escala dada. Usado tanto nos mini-canvas do painel (escala 1) como
// no overlay sobre o vídeo (escala maior, junto ao objeto).
// nivel: 0 (parado) a 1 (intenso).
function desenharMotivo(ctx, chave, nivel, t, escala = 1) {
  const W = LARGURA_VIS * escala;
  const H = ALTURA_VIS * escala;
  const cor = CORES_TRAO[chave];
  const motivo = MOTIVOS[chave];
  const a = 0.15 + 0.85 * nivel; // amplitude

  ctx.lineWidth = 1.6 * escala;
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;

  if (motivo === 'agua' || motivo === 'vento' || motivo === 'chuva') {
    // Ondas / rajadas / aguaceiro: linhas onduladas horizontais
    const linhas = motivo === 'chuva' ? 3 : 2;
    for (let l = 0; l < linhas; l++) {
      const yBase = H * (0.35 + l * 0.28);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3 * escala) {
        const y = yBase
          + Math.sin(x * (motivo === 'chuva' ? 0.30 : 0.12) / escala + t * (2 + l) + l * 2) * 4 * a * escala
          + (motivo === 'vento' ? Math.sin(x * 0.05 / escala - t * 3) * 3 * a * escala : 0);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (motivo === 'chuva') {
      // pingos a cair
      for (let p = 0; p < 4; p++) {
        const xg = (12 + p * 28 + (Math.sin(t * 1.7 + p) * 6 * a)) * escala;
        const yg = ((t * 60 * (0.6 + a) * escala + p * 23 * escala) % (H + 10 * escala)) - 5 * escala;
        ctx.fillRect(xg, yg, 1.4 * escala, 5 * escala);
      }
    }
  } else if (motivo === 'aves' || motivo === 'grilos' || motivo === 'zumbido' || motivo === 'cao') {
    // Pulsos: "batidas" rítmicas distintas por som
    const batidas = {
      aves: [0.3, 0.55, 0.8, 1.3, 1.7, 2.1],
      grilos: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6],
      zumbido: [0.15, 0.45, 0.75, 1.05, 1.35, 1.65, 1.95, 2.25, 2.55, 2.85, 3.15, 3.45, 3.75],
      cao: [0.3, 0.5, 1.8, 2.0, 3.4, 3.6],
    }[motivo];
    const ciclo = 4.0; // segundos
    const tc = t % ciclo;
    for (let b = 0; b < batidas.length; b++) {
      const x = (8 + b * ((LARGURA_VIS - 16) / (batidas.length - 1))) * escala;
      const dt = Math.abs(tc - batidas[b]);
      const pulso = Math.max(0, 1 - dt * 6) * a;
      const alt = (3 + pulso * (ALTURA_VIS * 0.75)) * escala;
      ctx.beginPath();
      ctx.arc(x, H - alt - 2 * escala, (2 + pulso * 2) * escala, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (motivo === 'trovoada') {
    // Relâmpagos: zig-zag ocasional com flash
    const ciclo = 4.0;
    const tc = t % ciclo;
    const flash = Math.max(0, 1 - Math.abs(tc - 1.0) * 8) * a;
    ctx.globalAlpha = 0.3 + flash;
    ctx.beginPath();
    ctx.moveTo(10 * escala, 4 * escala);
    ctx.lineTo(28 * escala, 16 * escala);
    ctx.lineTo(20 * escala, 16 * escala);
    ctx.lineTo(38 * escala, 30 * escala);
    ctx.stroke();
    if (flash > 0.5) {
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }
}

// Desenha um frame do visualizador de um elemento no painel.
function desenharVisualizador(chave, nivel, t) {
  const ctx = visualizadores[chave];
  if (!ctx) return;
  ctx.clearRect(0, 0, LARGURA_VIS, ALTURA_VIS);
  desenharMotivo(ctx, chave, nivel, t, 1);
}

// Atualiza todos os visualizadores; chamado no loop de animação.
// Sem instrumento ativo, não desenha (os canvas ficam limpos).
function passoVisualizadores(cores, t) {
  for (const chave of Object.keys(visualizadores)) {
    const info = cores ? cores[chave] : null;
    const nivel = info && info.presente ? info.intensidade : 0;
    desenharVisualizador(chave, nivel, t);
  }
}

// ---------- Barras-guia (volume e panorâmica) ----------

// A barra de volume mostra a intensidade do objeto presente mais
// intenso; a da panorâmica mostra a posição horizontal do objeto
// presente mais intenso. Sem objetos, o volume esvazia e o marcador
// regressa ao centro.
function atualizarBarrasGuia(cores) {
  let melhorIntensidade = 0;
  let melhorPosX = 0.5;
  for (const info of Object.values(cores)) {
    if (info.presente && info.intensidade > melhorIntensidade) {
      melhorIntensidade = info.intensidade;
      melhorPosX = info.posX;
    }
  }
  preenchimentoVolume.style.height = `${Math.round(melhorIntensidade * 100)}%`;
  const deslocamento = Math.max(-1, Math.min(1, (melhorPosX - 0.5) * 2)); // -1 a 1
  marcadorPan.style.left = `${50 + deslocamento * 40}%`;
}

// ---------- Loop principal ----------

function passo(agora) {
  if (!aCorrer) return;
  requestHandle = requestAnimationFrame(passo);
  // Visualizadores a 60 fps (leves); deteção limitada a ~30 fps
  if (ultimasCores) passoVisualizadores(ultimasCores, agora / 1000);
  if (agora - ultimaAnalise < INTERVALO_ANALISE_MS) return;
  ultimaAnalise = agora;
  const sensibilidade = sensibilidadeInput.value / 100;

  if (video.readyState >= 2) {
    const resultado = deteccao.analisar(video, sensibilidade);
    if (resultado) {
      ultimasCores = resultado.cores;
      desenharDeteccao(resultado);
      atualizarIndicadores(resultado.cores);
      atualizarBarrasGuia(resultado.cores);
      if (motorAudio.pronto) {
        for (const [chave, info] of Object.entries(resultado.cores)) {
          motorAudio.definirIntensidade(chave, info.intensidade);
          if (info.presente) motorAudio.definirPan(chave, info.posX);
        }
      }
    }
  }
}

// ---------- Iniciar / parar ----------

async function iniciar() {
  const id = ++pedidoId;
  botaoIniciar.disabled = true;
  definirMensagem('A pedir acesso à câmara…');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador ou contexto (por exemplo, file://) não permite o acesso à câmara. Abre a página por HTTPS ou localhost.');
    }

    const opcao = seletorCamara.value
      ? { deviceId: { exact: seletorCamara.value }, width: { ideal: 640 }, height: { ideal: 480 } }
      : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' };
    transmissao = await navigator.mediaDevices.getUserMedia({ video: opcao, audio: false });
    if (cancelado(id)) {
      // O utilizador clicou «Parar» enquanto a câmara era aberta
      limparTransmissao();
      return;
    }
    video.srcObject = transmissao;
    await video.play();
    await atualizarListaCameras();

    // O contexto de áudio só é criado dentro do clique (requisito dos navegadores)
    let avisosFalhas = null;
    if (!motorAudio.pronto) {
      definirMensagem('A preparar os sons…');
      const { falhas } = await motorAudio.iniciar(volumeGeral.value / 100);
      if (falhas) {
        avisosFalhas = falhas.map((c) => `«${NOMES_ELEMENTO[c] || c}»`).join(', ');
      }
    }
    if (cancelado(id)) {
      // O utilizador clicou «Parar» enquanto os sons carregavam
      motorAudio.parar();
      limparTransmissao();
      return;
    }

    if (avisosFalhas) {
      definirMensagem(`Instrumento ativo, mas não foi possível carregar o som de: ${avisosFalhas}. Verifica a ligação e recarrega a página.`);
    } else {
      definirMensagem('Instrumento ativo. Coloca os objetos coloridos na mesa e experimenta!');
    }

    aCorrer = true;
    botaoParar.disabled = false;
    molduraGuia.classList.remove('oculta');
    requestHandle = requestAnimationFrame(passo);
  } catch (erro) {
    console.error(erro);
    if (cancelado(id)) return; // o parar() já tratou da limpeza
    let texto = `Não foi possível iniciar: ${erro.message}`;
    if (erro.name === 'NotAllowedError') {
      texto = 'Acesso à câmara recusado. Autoriza a câmara nas permissões do navegador (ícone à esquerda da barra de endereço) e tenta de novo.';
    } else if (erro.name === 'NotFoundError') {
      texto = 'Não foi encontrada nenhuma câmara. Liga ou ativa a câmara e tenta de novo.';
    }
    definirMensagem(texto, true);
    botaoIniciar.disabled = false;
    limparTransmissao();
  }
}

function limparTransmissao() {
  if (transmissao) {
    for (const pista of transmissao.getTracks()) {
      pista.stop();
    }
    transmissao = null;
  }
  video.srcObject = null;
}

function parar() {
  pedidoId++; // invalida qualquer arranque ainda em curso
  aCorrer = false;
  if (requestHandle !== null) {
    cancelAnimationFrame(requestHandle);
    requestHandle = null;
  }
  motorAudio.parar();
  limparTransmissao();

  molduraGuia.classList.add('oculta');
  preenchimentoVolume.style.height = '0%';
  marcadorPan.style.left = '50%';
  ultimasCores = null;
  passoVisualizadores({}, performance.now() / 1000);
  ctxCanvas.clearRect(0, 0, canvasDetecao.width, canvasDetecao.height);
  for (const el of Object.values(indicadores)) {
    el.classList.remove('ativo');
    el.querySelector('.estado').textContent = '—';
  }

  botaoParar.disabled = true;
  botaoIniciar.disabled = false;
  definirMensagem('Instrumento parado. Clica em «Iniciar instrumento» para continuar.');
}

// ---------- Eventos ----------

criarVisualizadores();
// Estado de repouso: um frame discreto em todos os visualizadores,
// para serem visíveis desde o carregamento da página.
for (const chave of Object.keys(visualizadores)) {
  desenharVisualizador(chave, 0, 0);
}

botaoIniciar.addEventListener('click', iniciar);
botaoParar.addEventListener('click', parar);

// Ouvir / carregar sons por elemento (delegação no painel inteiro)
const painelElementos = document.querySelector('.coluna-painel');

painelElementos.addEventListener('click', async (evento) => {
  const botao = evento.target.closest('button.ouvir');
  if (!botao) return;
  const chave = botao.dataset.chave;
  try {
    // Garante que os sons base estão carregados antes de ouvir
    if (!motorAudio.pronto) {
      await motorAudio.iniciar(volumeGeral.value / 100);
    }
    const ok = await motorAudio.ouvir(chave);
    if (!ok) {
      definirMensagem('Som indisponível. Clica primeiro em «Iniciar instrumento».');
    }
  } catch (erro) {
    definirMensagem(`Não foi possível ouvir o som: ${erro.message}`, true);
  }
});

painelElementos.addEventListener('change', async (evento) => {
  const input = evento.target.closest('input[type="file"]');
  if (!input) return;
  const ficheiro = input.files && input.files[0];
  input.value = '';
  if (!ficheiro) return;
  const chave = input.dataset.chave;
  const nomeEl = NOMES_ELEMENTO[chave];
  try {
    const dados = await ficheiro.arrayBuffer();
    if (!motorAudio.pronto) {
      await motorAudio.iniciar(volumeGeral.value / 100);
    }
    const duracao = await motorAudio.substituirSom(chave, dados, volumeGeral.value / 100);
    definirMensagem(`Som de «${nomeEl}» substituído por «${ficheiro.name}» (${duracao.toFixed(1)} s). Mantém-se ao parar e reiniciar; volta ao original ao recarregar a página.`);
  } catch (erro) {
    definirMensagem(`Não foi possível carregar «${ficheiro.name}»: ${erro.message}`, true);
  }
});

volumeGeral.addEventListener('input', () => {
  atualizarSaidas();
  motorAudio.definirVolumeGeral(volumeGeral.value / 100);
});

sensibilidadeInput.addEventListener('input', atualizarSaidas);

atualizarSaidas();
