// audio.js — motor de áudio com Web Audio API
// Cada paisagem sonora é um BufferSource em ciclo contínuo ligado a um
// GainNode. A presença do objeto sobe o ganho (fade suave); a ausência
// baixa-o gradualmente. O loop nunca reinicia quando o objeto se move.

export class MotorAudio {
  constructor() {
    this.ctx = null;
    this.ganhoGeral = null;
    this.canais = null;
    this.buffers = {};   // buffers por chave, para pré-escuta e substituição
  }

  // Garante um AudioContext (chamado a partir de um clique).
  async garantirContexto(volumeGeral = 0.7) {
    if (this.ctx) {
      // Alguns navegadores suspendem o contexto a meio da sessão
      // (política de autoplay); retomar aqui é inócuo se já estiver
      // ativo e recupera o som se não estiver.
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) { /* ignorar */ }
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      throw new Error('Este navegador não suporta a Web Audio API.');
    }
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Compressor antes da saída: com cinco paisagens simultâneas, a
    // soma dos ganhos pode exceder 1 e provocar clipping audível. O
    // compressor limita os picos de forma suave (ataque rápido,
    // libertação lenta), mantendo a mistura natural.
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18; // começa a comprimir cedo
    this.compressor.knee.value = 12;        // transição suave
    this.compressor.ratio.value = 4;        // compressão moderada
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.3;

    this.ganhoGeral = this.ctx.createGain();
    this.ganhoGeral.gain.value = volumeGeral;

    this.ganhoGeral.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
  }

  // Pré-escuta: toca o som de um elemento uma vez (sem loop), com
  // fade suave, sem interferir com os loops da deteção.
  async ouvir(chave) {
    if (!this.buffers[chave]) return false;
    await this.garantirContexto();
    const origem = this.ctx.createBufferSource();
    origem.buffer = this.buffers[chave];
    const ganho = this.ctx.createGain();
    const agora = this.ctx.currentTime;
    ganho.gain.setValueAtTime(0.0001, agora);
    ganho.gain.setTargetAtTime(0.9, agora, 0.05);
    const dur = origem.buffer.duration;
    ganho.gain.setTargetAtTime(0.0001, agora + dur - 0.4, 0.15);
    origem.connect(ganho);
    ganho.connect(this.ganhoGeral);
    origem.start();
    origem.stop(agora + dur + 0.2);
    return true;
  }

  // Substitui o som de um elemento por um ficheiro carregado pelo
  // utilizador (ArrayBuffer). Se o motor já estiver a correr, o loop
  // é trocado sem interromper os restantes.
  async substituirSom(chave, dadosArrayBuffer, volumeGeral = 0.7) {
    await this.garantirContexto(volumeGeral);
    const buffer = await this.ctx.decodeAudioData(dadosArrayBuffer);
    this.buffers[chave] = buffer;

    const canal = this.canais && this.canais[chave];
    if (canal) {
      try { canal.origem.stop(); } catch (e) { /* ignorar */ }
      const origem = this.ctx.createBufferSource();
      origem.buffer = buffer;
      origem.loop = true;
      origem.connect(canal.filtro);
      origem.start();
      canal.origem = origem;
    }
    return buffer.duration;
  }

  async iniciar(volumeGeral = 0.7) {
    await this.garantirContexto(volumeGeral);

    const ficheiros = {
      vermelho: 'audio/aves.wav',
      verde: 'audio/agua.wav',
      azul: 'audio/vento.wav',
      amarelo: 'audio/grilos.wav',
      preto: 'audio/trovoada.wav',
    };

    this.canais = {};

    try {
      // allSettled: um ficheiro que falhe não derruba os restantes —
      // os canais que carregarem ficam tocáveis e as falhas são
      // reportadas no fim, com o nome do elemento em causa.
      const resultados = await Promise.allSettled(Object.entries(ficheiros).map(async ([chave, url]) => {
        // Se já existe um buffer para esta chave (som substituído pelo
        // utilizador numa sessão anterior, ou pré-carregado), é usado e
        // o ficheiro base não é descarregado de novo.
        let buffer = this.buffers[chave];
        if (!buffer) {
          const resposta = await fetch(url);
          if (!resposta.ok) {
            throw new Error(`Não foi possível carregar o ficheiro de áudio: ${url}`);
          }
          const dados = await resposta.arrayBuffer();
          buffer = await this.ctx.decodeAudioData(dados);
          this.buffers[chave] = buffer;
        }

        const origem = this.ctx.createBufferSource();
        origem.buffer = buffer;
        origem.loop = true;

        // Filtro passa-baixo suave para reduzir ruído de fundo dos loops
        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 6500;

        // Panorâmica estéreo: a posição horizontal do objeto move o
        // som entre as colunas esquerda e direita.
        const pan = this.ctx.createStereoPanner
          ? this.ctx.createStereoPanner()
          : null; // navegadores antigos: sem pan, som centrado
        if (pan) pan.pan.value = 0;

        const ganho = this.ctx.createGain();
        ganho.gain.value = 0.0001; // praticamente silencioso até haver deteção

        origem.connect(filtro);
        filtro.connect(ganho);
        if (pan) {
          ganho.connect(pan);
          pan.connect(this.ganhoGeral);
        } else {
          ganho.connect(this.ganhoGeral);
        }
        origem.start();

        this.canais[chave] = { origem, ganho, filtro, pan };
      }));

      const falhas = [];
      for (let i = 0; i < resultados.length; i++) {
        if (resultados[i].status === 'rejected') {
          falhas.push(Object.keys(ficheiros)[i]);
          console.error(`Som de «${Object.keys(ficheiros)[i]}»:`, resultados[i].reason);
        }
      }

      if (falhas.length === Object.keys(ficheiros).length) {
        // Nada carregou: não faz sentido manter o contexto aberto.
        try { this.ctx.close(); } catch (e) { /* ignorar */ }
        this.ctx = null;
        this.canais = null;
        throw new Error('Nenhum ficheiro de áudio pôde ser carregado.');
      }
      if (falhas.length > 0) {
        return { falhas };
      }
      return { falhas: null };
    } catch (erro) {
      // Se nem o contexto pôde ser preparado, fecha-o para não acumular
      // contextos de áudio abertos em novas tentativas.
      try { this.ctx.close(); } catch (e) { /* ignorar */ }
      this.ctx = null;
      this.canais = null;
      throw erro;
    }
  }

  definirVolumeGeral(v) {
    if (!this.ctx) return;
    const agora = this.ctx.currentTime;
    this.ganhoGeral.gain.cancelScheduledValues(agora);
    this.ganhoGeral.gain.setTargetAtTime(v, agora, 0.05);
  }

  // Atualiza o ganho de um canal com transição suave (rampa exponencial).
  // valor: 0 a 1; mapeado para um máximo de 0,75 por canal.
  definirIntensidade(chave, valor) {
    const canal = this.canais && this.canais[chave];
    if (!canal) return;
    const TETO_CANAL = 0.75;
    const alvo = Math.max(0.0001, Math.min(1, valor)) * TETO_CANAL;
    const agora = this.ctx.currentTime;
    // setTargetAtTime dá aproximação exponencial sem cliques
    canal.ganho.gain.setTargetAtTime(alvo, agora, 0.25);
  }

  // Posição horizontal (0 = esquerda, 1 = direita) em panorâmica estéreo.
  definirPan(chave, posX) {
    const canal = this.canais && this.canais[chave];
    if (!canal || !canal.pan) return; // sem suporte: permanece centrado
    const alvo = (Math.min(1, Math.max(0, posX)) - 0.5) * 2; // -1 a 1
    const agora = this.ctx.currentTime;
    canal.pan.pan.setTargetAtTime(alvo, agora, 0.3);
  }

  parar() {
    if (!this.ctx) return;
    for (const chave of Object.keys(this.canais || {})) {
      try {
        this.canais[chave].origem.stop();
      } catch (e) {
        // já parado — ignorar
      }
    }
    this.ctx.close();
    this.ctx = null;
    this.canais = null;
  }

  get pronto() {
    // Pronto exige loops criados (canais), não apenas o contexto:
    // «Ouvir» cria o contexto antes dos loops e não deve fazer o
    // instrumento parecer iniciado.
    return this.ctx !== null && this.canais !== null
      && Object.keys(this.canais).length > 0;
  }
}
