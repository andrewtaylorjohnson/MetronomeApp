const MIN_TEMPO = 20;
const MAX_TEMPO = 300;
const STEP_COUNT = 16;

const app = document.getElementById('app');
const tempoMain = document.getElementById('tempo-main');
const tempoSequencer = document.getElementById('tempo-seq');
const decreaseMain = document.getElementById('decrease-main');
const increaseMain = document.getElementById('increase-main');
const decreaseSeq = document.getElementById('decrease-seq');
const increaseSeq = document.getElementById('increase-seq');
const pauseButton = document.getElementById('pause');
const soundButton = document.getElementById('sound');
const modeButton = document.getElementById('mode');
const sequencer = document.getElementById('sequencer');

let tempo = 120;
let mode = 'simple';
let currentStep = 0;
let simpleSoundMode = 0;
let editLayer = 0;
let isPaused = false;
let pendingTempo = null;

const sequences = [
  Array.from({ length: STEP_COUNT }, (_, index) => index % 2 === 0),
  Array(STEP_COUNT).fill(false),
];

let stepButtons = [];
let audioContext;
let metronomeTimer;
let stepIntervalMs = Math.round(60000 / (tempo * 2));

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
  for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1;
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
  const click = audioContext.createOscillator();
  const clickGain = audioContext.createGain();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(185, time);
  osc.frequency.exponentialRampToValueAtTime(52, time + 0.085);

  click.type = 'triangle';
  click.frequency.setValueAtTime(950, time);
  click.frequency.exponentialRampToValueAtTime(420, time + 0.028);
  clickGain.gain.setValueAtTime(0.0001, time);
  clickGain.gain.exponentialRampToValueAtTime(0.14, time + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.85, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

  osc.connect(gain);
  click.connect(clickGain);
  gain.connect(audioContext.destination);
  clickGain.connect(audioContext.destination);
  osc.start(time);
  click.start(time);
  osc.stop(time + 0.17);
  click.stop(time + 0.032);
};

const playSound = (soundIndex) => {
  if (!audioContext) return;
  const at = audioContext.currentTime + 0.002;
  if (soundIndex === 0) playWoodBlock(at);
  if (soundIndex === 1) playWarmKick(at);
};

const updatePauseIcon = () => {
  pauseButton.innerHTML = isPaused
    ? '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" /></svg>'
    : '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>';
};

const updateModeIcon = () => {
  modeButton.innerHTML =
    mode === 'simple'
      ? '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" /></svg>'
      : '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M12 3a1 1 0 0 1 1 1v2.06a7 7 0 0 1 4.94 4.94H20a1 1 0 1 1 0 2h-2.06a7 7 0 0 1-4.94 4.94V20a1 1 0 1 1-2 0v-2.06a7 7 0 0 1-4.94-4.94H4a1 1 0 1 1 0-2h2.06a7 7 0 0 1 4.94-4.94V4a1 1 0 0 1 1-1zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z\" /></svg>';
};

const updateSoundButtonState = () => {
  soundButton.classList.toggle('active-layer', mode === 'sequencer' && editLayer === 1);
};

const updateTheme = () => {
  const selectedSound = mode === 'sequencer' ? editLayer : simpleSoundMode;
  app.classList.toggle('wood-theme', selectedSound === 0);
  app.classList.toggle('kick-theme', selectedSound === 1);
};

const highlightCurrentStep = () => {
  stepButtons.forEach((button, index) => {
    button.classList.toggle('current', mode === 'sequencer' && index === currentStep);
  });
};

const renderActiveLayer = () => {
  stepButtons.forEach((button, index) => {
    button.classList.toggle('active', sequences[editLayer][index]);
    button.classList.toggle('layer-two', editLayer === 1);
  });
};

const runStep = () => {
  if (mode === 'simple') {
    if (currentStep % 2 === 0) playSound(simpleSoundMode);
  } else {
    if (sequences[0][currentStep]) playSound(0);
    if (sequences[1][currentStep]) playSound(1);
  }

  currentStep = (currentStep + 1) % STEP_COUNT;
  highlightCurrentStep();

  if (pendingTempo !== null) {
    tempo = pendingTempo;
    pendingTempo = null;
    stepIntervalMs = Math.round(60000 / (tempo * 2));
    if (!isPaused) {
      clearInterval(metronomeTimer);
      metronomeTimer = setInterval(runStep, stepIntervalMs);
    }
  }
};

const startMetronome = async () => {
  if (isPaused) return;
  await ensureAudio();
  if (metronomeTimer) clearInterval(metronomeTimer);
  stepIntervalMs = Math.round(60000 / (tempo * 2));
  runStep();
  metronomeTimer = setInterval(runStep, stepIntervalMs);
};

const syncTempoText = () => {
  const value = String(tempo);
  tempoMain.textContent = value;
  tempoSequencer.textContent = value;
};

const setTempo = async (nextTempo) => {
  const clamped = clampTempo(Number(nextTempo) || MIN_TEMPO);
  tempo = clamped;
  pendingTempo = clamped;
  syncTempoText();
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
  if (nextMode === 'simple') {
    simpleSoundMode = editLayer;
  } else {
    editLayer = simpleSoundMode;
  }
  mode = nextMode;
  app.classList.toggle('sequencer-mode', mode === 'sequencer');
  renderActiveLayer();
  updateSoundButtonState();
  updateModeIcon();
  updateTheme();
  highlightCurrentStep();
};

const toggleModeBySwipe = () => {
  setMode(mode === 'simple' ? 'sequencer' : 'simple');
};

const renderSequencer = () => {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < STEP_COUNT; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'step';
    button.addEventListener('click', () => {
      sequences[editLayer][index] = !sequences[editLayer][index];
      renderActiveLayer();
    });
    stepButtons.push(button);
    fragment.appendChild(button);
  }

  sequencer.appendChild(fragment);
  renderActiveLayer();
  highlightCurrentStep();
};

tempoMain.addEventListener('click', () => swapToInput(tempoMain));
tempoSequencer.addEventListener('click', () => swapToInput(tempoSequencer));

[decreaseMain, decreaseSeq].forEach((button) => {
  button.addEventListener('click', async () => {
    await setTempo(tempo - 1);
  });
});

[increaseMain, increaseSeq].forEach((button) => {
  button.addEventListener('click', async () => {
    await setTempo(tempo + 1);
  });
});

soundButton.addEventListener('click', async () => {
  if (mode === 'simple') {
    simpleSoundMode = (simpleSoundMode + 1) % 2;
    updateTheme();
    await startMetronome();
    return;
  }

  editLayer = (editLayer + 1) % 2;
  renderActiveLayer();
  updateSoundButtonState();
  updateTheme();
});

pauseButton.addEventListener('click', async () => {
  isPaused = !isPaused;
  updatePauseIcon();
  if (isPaused) {
    if (metronomeTimer) clearInterval(metronomeTimer);
    metronomeTimer = undefined;
    return;
  }
  await startMetronome();
});

modeButton.addEventListener('click', () => {
  toggleModeBySwipe();
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !audioContext || isPaused) return;
  await startMetronome();
});

renderSequencer();
syncTempoText();
updatePauseIcon();
updateSoundButtonState();
updateModeIcon();
updateTheme();
startMetronome();
