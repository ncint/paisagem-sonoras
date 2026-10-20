// teste-audio.mjs — testes da lógica do MotorAudio com Web Audio simulada.
// Executar:  node ferramentas/teste-audio.mjs
//
// Substitui window.AudioContext e fetch por versões simuladas e
// verifica os fluxos que já causaram bugs reais:
//   1. iniciar() cria 5 loops e fica «pronto»;
//   2. ouvir() ANTES de iniciar() não deve fazer o motor parecer pronto;
//   3. parar() + iniciar() mantém os sons substituídos pelo utilizador;
//   4. substituirSom() troca o loop a quente sem tocar nos restantes;
//   5. iniciar() falho (fetch com erro) fecha o contexto sem o deixar
//      órfão e permite nova tentativa.

import { MotorAudio } from '../js/audio.js';

let falhas = 0;
function verificar(nome, condicao, detalhe = '') {
  if (condicao) console.log(`OK    ${nome}`);
  else { falhas++; console.error(`FALHA ${nome} ${detalhe}`); }
}

// ---------- Simulação da Web Audio API ----------

class GainNodeSim {
  constructor() {
    this.gain = {
      _v: 1,
      setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {},
      set value(v) { this._v = v; }, get value() { return this._v; },
    };
    this.conexoes = [];
  }
  connect(no) { this.conexoes.push(no); return no; }
}

class BufferSourceSim {
  constructor() { this.conexoes = []; this._started = false; this._stopped = false; }
  connect(no) { this.conexoes.push(no); return no; }
  start() { this._started = true; }
  stop() { this._stopped = true; }
}

class BiquadFilterSim extends GainNodeSim {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = { value: 0 };
  }
}

class AudioContextSim {
  constructor() {
    this.destination = {};
    this.state = 'running';
    this.closed = false;
    window.__contextosAbertos = (window.__contextosAbertos || 0) + 1;
  }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; window.__contextosAbertos--; }
  createGain() { return new GainNodeSim(); }
  createBufferSource() { return new BufferSourceSim(); }
  createBiquadFilter() { return new BiquadFilterSim(); }
  decodeAudioData(buf) {
    return Promise.resolve({ duration: 10, __marca: buf });
  }
}

const WAV_FALSO = new Uint8Array(100).buffer;

const FICHEIROS_BASE = {
  vermelho: 'audio/aves.wav',
  verde: 'audio/agua.wav',
  azul: 'audio/vento.wav',
  amarelo: 'audio/grilos.wav',
  preto: 'audio/trovoada.wav',
};

// fetch simulado: devolve sempre sucesso com um "WAV" identificável
globalThis.window = globalThis;
globalThis.AudioContext = AudioContextSim;
globalThis.fetch = (url) => {
  if (url.includes('INEXISTENTE')) {
    return Promise.reject(new Error('ficheiro em falta'));
  }
  return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(WAV_FALSO) });
};

// ---------- 1. iniciar() ----------

{
  const m = new MotorAudio();
  await m.iniciar(0.7);
  verificar('iniciar() fica pronto', m.pronto === true);
  verificar('iniciar() cria 5 loops', Object.keys(m.canais).length === 5);
  verificar('todos os loops a tocar', Object.values(m.canais).every(c => c.origem._started));
}

// ---------- 2. ouvir() antes de iniciar() ----------

{
  const m = new MotorAudio();
  // ouvir() sem buffers: não faz nada, não cria contexto por engano
  const antes = window.__contextosAbertos || 0;
  const ok = await m.ouvir('vermelho');
  verificar('ouvir() sem sons carregados devolve false e não gasta contexto',
    ok === false && (window.__contextosAbertos || 0) === antes);

  // pré-carregar buffers como se um «Carregar» tivesse acontecido
  await m.substituirSom('vermelho', WAV_FALSO);
  const ok2 = await m.ouvir('vermelho');
  verificar('ouvir() com som carregado toca', ok2 === true);
  verificar('ouvir() antes de iniciar() NÃO faz o motor ficar pronto',
    m.pronto === false, `pronto=${m.pronto}`);
}

// ---------- 3. parar + iniciar mantém sons substituídos ----------

{
  const m = new MotorAudio();
  await m.iniciar(0.7);
  const bufferSub = await m.substituirSom('azul', WAV_FALSO);
  verificar('substituirSom devolve duração', Math.abs(bufferSub - 10) < 0.01);
  const marcaOriginal = m.buffers.verde;
  m.parar();
  verificar('parar() fecha o contexto', m.ctx === null);
  await m.iniciar(0.7);
  verificar('após parar+iniciar continua pronto', m.pronto === true);
  verificar('som substituído mantém-se após parar+iniciar',
    m.buffers.azul.__marca === WAV_FALSO);
  verificar('sons não substituídos são recarregados',
    m.buffers.verde !== undefined);
}

// ---------- 4. substituir a quente não mexe nos outros ----------

{
  const m = new MotorAudio();
  await m.iniciar(0.7);
  const origemVerdeAntes = m.canais.verde.origem;
  await m.substituirSom('azul', WAV_FALSO);
  verificar('substituir «azul» não reinicia o loop do «verde»',
    m.canais.verde.origem === origemVerdeAntes);
  verificar('loop do «azul» foi mesmo substituído',
    m.canais.azul.origem !== undefined && m.canais.azul.origem._started);
}

// ---------- 5. iniciar() falho não deixa contexto órfão ----------

{
  const antes = window.__contextosAbertos || 0;
  const m = new MotorAudio();
  // forçar falha: substituir fetch por um que falha
  const fetchReal = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('rede indisponível'));
  let lancou = false;
  try { await m.iniciar(0.7); } catch (e) { lancou = true; }
  globalThis.fetch = fetchReal;
  verificar('iniciar() falho lança o erro', lancou === true);
  verificar('iniciar() falho não deixa contexto aberto',
    m.ctx === null && (window.__contextosAbertos || 0) === antes);
  // e uma nova tentativa funciona
  await m.iniciar(0.7);
  verificar('nova tentativa após falha funciona', m.pronto === true);
}

// ---------- Resumo ----------

if (falhas === 0) {
  console.log('\nTodos os testes de áudio passaram.');
  process.exit(0);
} else {
  console.error(`\n${falhas} teste(s) de áudio falharam.`);
  process.exit(1);
}
