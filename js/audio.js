// audio.js — motor de áudio com Web Audio API
// Cada paisagem sonora é um BufferSource em ciclo contínuo ligado a um
// GainNode. A presença do objeto sobe o ganho (fade suave); a ausência
// baixa-o gradualmente. O loop nunca reinicia quando o objeto se move.

export class MotorAudio {
  constructor() {
    this.ctx = null;
    this.ganhoGeral = null;
    this.canais = null;
    this.aCarregar = 0;
  }

  async iniciar(volumeGeral = 0.7) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      throw new Error('Este navegador não suporta a Web Audio API.');
    }
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.ganhoGeral = this.ctx.createGain();
    this.ganhoGeral.gain.value = volumeGeral;
    this.ganhoGeral.connect(this.ctx.destination);

    const ficheiros = {
      vermelho: 'audio/aves.wav',
      verde: 'audio/agua.wav',
      azul: 'audio/vento.wav',
    };

    this.canais = {};
    this.aCarregar = Object.keys(ficheiros).length;

    try {
      await Promise.all(Object.entries(ficheiros).map(async ([chave, url]) => {
        const resposta = await fetch(url);
        if (!resposta.ok) {
          throw new Error(`Não foi possível carregar o ficheiro de áudio: ${url}`);
        }
        const dados = await resposta.arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(dados);

        const origem = this.ctx.createBufferSource();
        origem.buffer = buffer;
        origem.loop = true;

        // Filtro passa-baixo suave para reduzir ruído de fundo dos loops
        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 6500;

        const ganho = this.ctx.createGain();
        ganho.gain.value = 0.0001; // praticamente silencioso até haver deteção

        origem.connect(filtro);
        filtro.connect(ganho);
        ganho.connect(this.ganhoGeral);
        origem.start();

        this.canais[chave] = { origem, ganho, filtro };
        this.aCarregar--;
      }));
    } catch (erro) {
      // Se o carregamento falhar, fecha o contexto para não acumular
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
  definirIntensidade(chave, valor) {
    const canal = this.canais && this.canais[chave];
    if (!canal) return;
    const alvo = Math.max(0.0001, Math.min(1, valor));
    const agora = this.ctx.currentTime;
    // setTargetAtTime dá aproximação exponencial sem cliques
    canal.ganho.gain.setTargetAtTime(alvo, agora, 0.25);
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
    return this.ctx !== null && this.aCarregar === 0;
  }
}
