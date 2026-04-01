const MIN_TEMPO = 20;
const MAX_TEMPO = 300;

const tempoButton = document.getElementById('tempo');
const decreaseButton = document.getElementById('decrease');
const increaseButton = document.getElementById('increase');
const soundButton = document.getElementById('sound');

let tempo = 120;
let soundMode = 0;
let audioContext;
let metronomeTimer;

const clampTempo = (value) => Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, value));

const ensureAudio = async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
};

const createNoiseBuffer = () => {
  const size = audioContext.sampleRate * 0.05;
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

const playWoodBlock = (time) => {
  const noise = audioContext.createBufferSource();
  noise.buffer = createNoiseBuffer();

  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1700, time);
  filter.Q.value = 8;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.9, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  noise.start(time);
  noise.stop(time + 0.05);
};

const playDigitalBlip = (time) => {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1300, time);
  osc.frequency.exponentialRampToValueAtTime(700, time + 0.06);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.25, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(time);
  osc.stop(time + 0.075);
};

const playWarmKick = (time) => {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(165, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.09);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.7, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(time);
  osc.stop(time + 0.17);
};

const playTick = () => {
  if (!audioContext) return;
  const at = audioContext.currentTime + 0.002;
  if (soundMode === 0) playWoodBlock(at);
  if (soundMode === 1) playDigitalBlip(at);
  if (soundMode === 2) playWarmKick(at);
};

const startMetronome = async () => {
  await ensureAudio();
  if (metronomeTimer) clearInterval(metronomeTimer);
  playTick();
  const interval = Math.round(60000 / tempo);
  metronomeTimer = setInterval(playTick, interval);
};

const setTempo = async (nextTempo) => {
  const clamped = clampTempo(Number(nextTempo) || MIN_TEMPO);
  tempo = clamped;
  tempoButton.textContent = String(tempo);
  await startMetronome();
};

const swapToInput = () => {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'tempo-input';
  input.inputMode = 'numeric';
  input.min = String(MIN_TEMPO);
  input.max = String(MAX_TEMPO);
  input.value = String(tempo);

  const finish = async () => {
    await setTempo(input.value);
    input.replaceWith(tempoButton);
    tempoButton.focus();
  };

  input.addEventListener('input', async () => {
    if (!input.value) return;
    await setTempo(input.value);
  });

  input.addEventListener('blur', finish, { once: true });
  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      input.blur();
    }
  });

  tempoButton.replaceWith(input);
  input.focus();
  input.select();
};

tempoButton.addEventListener('click', swapToInput);

decreaseButton.addEventListener('click', async () => {
  await setTempo(tempo - 1);
});

increaseButton.addEventListener('click', async () => {
  await setTempo(tempo + 1);
});

soundButton.addEventListener('click', async () => {
  soundMode = (soundMode + 1) % 3;
  await startMetronome();
});

document.addEventListener(
  'visibilitychange',
  async () => {
    if (document.hidden || !audioContext) return;
    await startMetronome();
  },
  false,
);
