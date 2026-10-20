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

const indicadores = {
  vermelho: document.getElementById('ind-aves'),
  verde: document.getElementById('ind-agua'),
  azul: document.getElementById('ind-vento'),
};

const NOMES_ELEMENTO = {
  vermelho: 'aves',
  verde: 'água',
  azul: 'vento',
};

// ---------- Estado ----------

const deteccao = new DeteccaoCores(160);
const motorAudio = new MotorAudio();
let transmissao = null;   // MediaStream da câmara
let requestHandle = null; // id do loop de animação
let aCorrer = false;
let pedidoId = 0;         // distingue cada clique em «Iniciar»; permite cancelar

function cancelado(id) {
  return id !== pedidoId;
}

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

  for (const [chave, info] of Object.entries(res.cores)) {
    if (!info.presente || info.posY === null) continue;
    const cor = {
      vermelho: 'rgba(201, 79, 61, 0.85)',
      verde: 'rgba(76, 140, 74, 0.85)',
      azul: 'rgba(74, 127, 181, 0.85)',
    }[chave];

    // Marcador horizontal na altura média do objeto (que controla a
    // intensidade): fundo da imagem = mais intenso.
    const y = info.posY * alturaVisivel + offsetY;
    ctxCanvas.fillStyle = cor;
    ctxCanvas.fillRect(0, y - 2, larguraPx, 4);

    // Etiqueta junto ao marcador, sem sair da imagem
    ctxCanvas.font = 'bold 16px sans-serif';
    const rotulo = NOMES_ELEMENTO[chave];
    const larguraTexto = ctxCanvas.measureText(rotulo).width;
    const etiqX = Math.min(Math.max(offsetX + 8, 8), Math.max(larguraPx - larguraTexto - 16, 8));
    const etiqY = Math.min(Math.max(y - 34, 4), Math.max(alturaPx - 30, 4));
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
    estadoEl.textContent = info.presente ? 'ativo' : 'desligado';
  }
}

// ---------- Loop principal ----------

function passo() {
  if (!aCorrer) return;
  const sensibilidade = sensibilidadeInput.value / 100;

  if (video.readyState >= 2) {
    const resultado = deteccao.analisar(video, sensibilidade);
    if (resultado) {
      desenharDeteccao(resultado);
      atualizarIndicadores(resultado.cores);
      if (motorAudio.pronto) {
        for (const [chave, info] of Object.entries(resultado.cores)) {
          motorAudio.definirIntensidade(chave, info.intensidade);
        }
      }
    }
  }
  requestHandle = requestAnimationFrame(passo);
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

    transmissao = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      audio: false,
    });
    if (cancelado(id)) {
      // O utilizador clicou «Parar» enquanto a câmara era aberta
      limparTransmissao();
      return;
    }
    video.srcObject = transmissao;
    await video.play();

    // O contexto de áudio só é criado dentro do clique (requisito dos navegadores)
    if (!motorAudio.pronto) {
      definirMensagem('A preparar os sons…');
      await motorAudio.iniciar(volumeGeral.value / 100);
    }
    if (cancelado(id)) {
      // O utilizador clicou «Parar» enquanto os sons carregavam
      motorAudio.parar();
      limparTransmissao();
      return;
    }

    aCorrer = true;
    botaoParar.disabled = false;
    definirMensagem('Instrumento ativo. Coloca os objetos coloridos na mesa e experimenta!');
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

  ctxCanvas.clearRect(0, 0, canvasDetecao.width, canvasDetecao.height);
  for (const el of Object.values(indicadores)) {
    el.classList.remove('ativo');
    el.querySelector('.estado').textContent = 'desligado';
  }

  botaoParar.disabled = true;
  botaoIniciar.disabled = false;
  definirMensagem('Instrumento parado. Clica em «Iniciar instrumento» para continuar.');
}

// ---------- Eventos ----------

botaoIniciar.addEventListener('click', iniciar);
botaoParar.addEventListener('click', parar);

volumeGeral.addEventListener('input', () => {
  atualizarSaidas();
  motorAudio.definirVolumeGeral(volumeGeral.value / 100);
});

sensibilidadeInput.addEventListener('input', atualizarSaidas);

atualizarSaidas();
