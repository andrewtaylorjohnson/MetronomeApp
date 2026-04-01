const MIN_TEMPO = 20;
const MAX_TEMPO = 300;
const STEP_COUNT = 16;

const app = document.getElementById('app');
const screens = document.getElementById('screens');
const tempoMain = document.getElementById('tempo-main');
const tempoSequencer = document.getElementById('tempo-seq');
const decreaseButton = document.getElementById('decrease');
const increaseButton = document.getElementById('increase');
const soundButton = document.getElementById('sound');
const sequencer = document.getElementById('sequencer');

let tempo = 120;
let soundMode = 0;
let mode = 'simple';
let currentStep = 0;
let sequence = Array.from({ length: STEP_COUNT }, (_, index) => index % 2 === 0);
let stepButtons = [];

let audioContext;
let metronomeTimer;
let swipeStartX = null;

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
  if (soundMode === 1) playWarmKick(at);
};

const highlightCurrentStep = () => {
  stepButtons.forEach((button, index) => {
    button.classList.toggle('current', index === currentStep && mode === 'sequencer');
  });
};

const runStep = () => {
  const shouldPlaySimple = mode === 'simple' && currentStep % 2 === 0;
  const shouldPlaySequencer = mode === 'sequencer' && sequence[currentStep];

  if (shouldPlaySimple || shouldPlaySequencer) {
    playTick();
  }

  currentStep = (currentStep + 1) % STEP_COUNT;
  highlightCurrentStep();
};

const startMetronome = async () => {
  await ensureAudio();
  if (metronomeTimer) clearInterval(metronomeTimer);
  runStep();
  const interval = Math.round(60000 / (tempo * 2));
  metronomeTimer = setInterval(runStep, interval);
};

const syncTempoText = () => {
  const value = String(tempo);
  tempoMain.textContent = value;
  tempoSequencer.textContent = value;
};

const setTempo = async (nextTempo) => {
  const clamped = clampTempo(Number(nextTempo) || MIN_TEMPO);
  tempo = clamped;
  syncTempoText();
  await startMetronome();
};

const swapToInput = (tempoButton) => {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'tempo-input';
  input.inputMode = 'numeric';
  input.min = String(MIN_TEMPO);
  input.max = String(MAX_TEMPO);
  input.value = String(tempo);
  input.style.fontSize = getComputedStyle(tempoButton).fontSize;

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
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      input.blur();
    }
  });

  tempoButton.replaceWith(input);
  input.focus();
  input.select();
};

const setMode = (nextMode) => {
  if (nextMode === mode) return;
  mode = nextMode;
  app.classList.toggle('sequencer-mode', mode === 'sequencer');
  highlightCurrentStep();
};

const toggleModeBySwipe = () => {
  setMode(mode === 'simple' ? 'sequencer' : 'simple');
};

const renderSequencer = () => {
  const fragment = document.createDocumentFragment();

  sequence.forEach((isOn, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `step${isOn ? ' active' : ''}`;
    button.addEventListener('click', () => {
      sequence[index] = !sequence[index];
      button.classList.toggle('active', sequence[index]);
    });

    stepButtons.push(button);
    fragment.appendChild(button);
  });

  sequencer.appendChild(fragment);
  highlightCurrentStep();
};

tempoMain.addEventListener('click', () => swapToInput(tempoMain));
tempoSequencer.addEventListener('click', () => swapToInput(tempoSequencer));

decreaseButton.addEventListener('click', async () => {
  await setTempo(tempo - 1);
});

increaseButton.addEventListener('click', async () => {
  await setTempo(tempo + 1);
});

soundButton.addEventListener('click', async () => {
  soundMode = (soundMode + 1) % 2;
  await startMetronome();
});

screens.addEventListener('pointerdown', (event) => {
  swipeStartX = event.clientX;
});

screens.addEventListener('pointerup', (event) => {
  if (swipeStartX === null) return;
  const deltaX = event.clientX - swipeStartX;
  swipeStartX = null;

  if (Math.abs(deltaX) >= 40) {
    toggleModeBySwipe();
  }
});

document.addEventListener(
  'visibilitychange',
  async () => {
    if (document.hidden || !audioContext) return;
    await startMetronome();
  },
  false,
);

renderSequencer();
syncTempoText();
startMetronome();
