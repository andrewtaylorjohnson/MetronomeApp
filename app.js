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
let isPaused = true;
let pendingTempo = null;

const sequences = [
  Array.from({ length: STEP_COUNT }, (_, index) => index % 4 === 0),
  Array(STEP_COUNT).fill(false),
];

let stepButtons = [];
let audioContext;
let schedulerTimer;
let animationFrame;
let nextStepTime = 0;
let scheduledStep = currentStep;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const scheduledVisualSteps = [];

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
  osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(26, time + 0.085);

  click.type = 'triangle';
  click.frequency.setValueAtTime(640, time);
  click.frequency.exponentialRampToValueAtTime(300, time + 0.028);
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

const playClosedHiHat = (time) => {
  const noise = audioContext.createBufferSource();
  noise.buffer = createNoiseBuffer();

  const highpass = audioContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(6500, time);
  highpass.Q.value = 0.9;

  const bandpass = audioContext.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(10000, time);
  bandpass.Q.value = 1.2;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.33, time + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.032);

  noise.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(audioContext.destination);
  noise.start(time);
  noise.stop(time + 0.04);
};

const playSound = (soundIndex, at) => {
  if (!audioContext) return;
  if (soundIndex === 0) playWarmKick(at);
  if (soundIndex === 1) playClosedHiHat(at);
};

const updatePauseIcon = () => {
  pauseButton.innerHTML = isPaused
    ? '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" /></svg>'
    : '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M6 6h12v12H6z" /></svg>';
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

const highlightCurrentStep = () => {
  stepButtons.forEach((button, index) => {
    button.classList.toggle('current', mode === 'sequencer' && index === currentStep);
  });
};

const flashStep = (stepIndex) => {
  const button = stepButtons[stepIndex];
  if (!button) return;
  button.classList.remove('flash');
  void button.offsetWidth;
  button.classList.add('flash');
  window.setTimeout(() => {
    button.classList.remove('flash');
  }, 90);
};

const renderActiveLayer = () => {
  stepButtons.forEach((button, index) => {
    button.classList.toggle('active', sequences[editLayer][index]);
    button.classList.toggle('layer-two', editLayer === 1);
  });
};

const getStepDuration = () => 60 / (tempo * 4);

const scheduleOneStep = (stepIndex, atTime) => {
  if (mode === 'simple') {
    if (stepIndex % 4 === 0) playSound(simpleSoundMode, atTime);
  } else {
    if (sequences[0][stepIndex]) playSound(0, atTime);
    if (sequences[1][stepIndex]) playSound(1, atTime);
  }

  scheduledVisualSteps.push({ stepIndex, atTime });

  if (pendingTempo !== null) {
    tempo = pendingTempo;
    pendingTempo = null;
  }
};

const scheduler = () => {
  if (!audioContext || isPaused) return;

  while (nextStepTime < audioContext.currentTime + SCHEDULE_AHEAD_S) {
    scheduleOneStep(scheduledStep, nextStepTime);
    nextStepTime += getStepDuration();
    scheduledStep = (scheduledStep + 1) % STEP_COUNT;
  }
};

const animateSteps = () => {
  if (!audioContext || isPaused) return;

  const now = audioContext.currentTime;
  while (scheduledVisualSteps.length > 0 && scheduledVisualSteps[0].atTime <= now) {
    const next = scheduledVisualSteps.shift();
    currentStep = (next.stepIndex + 1) % STEP_COUNT;
    if (mode === 'sequencer') {
      flashStep(next.stepIndex);
    }
  }

  animationFrame = requestAnimationFrame(animateSteps);
};

const startMetronome = async () => {
  if (isPaused) return;
  await ensureAudio();
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (animationFrame) cancelAnimationFrame(animationFrame);
  scheduledVisualSteps.length = 0;
  scheduledStep = currentStep;
  nextStepTime = audioContext.currentTime + 0.005;
  scheduler();
  schedulerTimer = setInterval(scheduler, LOOKAHEAD_MS);
  animationFrame = requestAnimationFrame(animateSteps);
};

const syncTempoText = () => {
  const value = String(tempo);
  tempoMain.textContent = value;
  tempoSequencer.textContent = value;
};

const setTempo = async (nextTempo) => {
  const clamped = clampTempo(Number(nextTempo) || MIN_TEMPO);
  pendingTempo = clamped;
  tempo = clamped;
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
    await startMetronome();
    return;
  }

  editLayer = (editLayer + 1) % 2;
  renderActiveLayer();
  updateSoundButtonState();
});

pauseButton.addEventListener('click', async () => {
  isPaused = !isPaused;
  updatePauseIcon();
  if (isPaused) {
    if (schedulerTimer) clearInterval(schedulerTimer);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    schedulerTimer = undefined;
    animationFrame = undefined;
    scheduledVisualSteps.length = 0;
    currentStep = 0;
    scheduledStep = 0;
    stepButtons.forEach((button) => {
      button.classList.remove('flash');
    });
    return;
  }
  currentStep = 0;
  scheduledStep = 0;
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
