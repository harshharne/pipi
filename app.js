const SOUND_MS = 30_000;
const SU_PHRASE = [
  { label: "suuu", s: 0.08, u: 0.38, gap: 0.16 },
  { label: "suuuu", s: 0.08, u: 0.58, gap: 0.16 },
  { label: "suuuu", s: 0.08, u: 0.58, gap: 0.36 },
];
const SU_CYCLE_S = SU_PHRASE.reduce((sum, p) => sum + p.s * 0.5 + p.u + p.gap, 0);

const setup = document.getElementById("setup");
const waiting = document.getElementById("waiting");
const overlay = document.getElementById("overlay");
const countdownEl = document.getElementById("countdown");
const waitFill = document.getElementById("wait-fill");
const soundLeft = document.getElementById("sound-left");
const soundFill = document.getElementById("sound-fill");
const customMinutes = document.getElementById("custom-minutes");
const hint = document.getElementById("hint");
const shuuText = document.getElementById("shuu-text");

let intervalMinutes = 30;
let looping = false;
let waitTimer = null;
let soundTimer = null;
let soundRaf = null;
let waitStartedAt = 0;
let waitDurationMs = 0;
let sound = null;

document.querySelectorAll(".pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("is-on"));
    pill.classList.add("is-on");
    customMinutes.value = "";
    intervalMinutes = Number(pill.dataset.minutes);
  });
});

customMinutes.addEventListener("input", () => {
  const n = Number(customMinutes.value);
  if (n >= 1) {
    intervalMinutes = n;
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("is-on"));
  }
});

document.getElementById("start-btn").addEventListener("click", () => {
  const minutes = resolvedMinutes();
  if (!minutes) return;
  intervalMinutes = minutes;
  looping = true;
  beginWait(minutes * 60_000);
});

document.getElementById("preview-btn").addEventListener("click", () => {
  looping = false;
  fireReminder();
});

document.getElementById("now-btn").addEventListener("click", () => {
  fireReminder();
});

document.getElementById("stop-btn").addEventListener("click", () => {
  looping = false;
  clearWait();
  show(setup);
  hide(waiting);
});

document.getElementById("peed-btn").addEventListener("click", () => {
  stopSound();
  hide(overlay);
  if (looping) {
    beginWait(intervalMinutes * 60_000);
  } else {
    show(setup);
    hide(waiting);
  }
});

document.getElementById("mute-btn").addEventListener("click", () => {
  stopSound();
  soundLeft.textContent = "0";
  soundFill.style.width = "100%";
});

function resolvedMinutes() {
  const custom = Number(customMinutes.value);
  if (customMinutes.value !== "" && !(custom >= 1 && custom <= 180)) {
    hint.textContent = "Pick between 1 and 180 minutes.";
    return null;
  }
  return custom >= 1 ? custom : intervalMinutes;
}

function beginWait(durationMs) {
  clearWait();
  waitDurationMs = durationMs;
  waitStartedAt = Date.now();
  hide(setup);
  show(waiting);
  hide(overlay);
  tickWait();
  waitTimer = setInterval(tickWait, 200);
}

function tickWait() {
  const elapsed = Date.now() - waitStartedAt;
  const left = Math.max(0, waitDurationMs - elapsed);
  countdownEl.textContent = formatTime(left);
  waitFill.style.width = `${Math.min(100, (elapsed / waitDurationMs) * 100)}%`;
  if (left <= 0) {
    fireReminder();
  }
}

function fireReminder() {
  clearWait();
  hide(setup);
  hide(waiting);
  show(overlay);
  playShuuu();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Pipi — go pee", { body: "suuu suuuu suuuu for 30 seconds" });
  } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function playShuuu() {
  stopSound();
  sound = createShuuu();
  sound.start();
  const started = Date.now();
  const update = () => {
    const left = Math.max(0, SOUND_MS - (Date.now() - started));
    soundLeft.textContent = String(Math.ceil(left / 1000));
    soundFill.style.width = `${((SOUND_MS - left) / SOUND_MS) * 100}%`;
    shuuText.textContent = currentSuLabel(SOUND_MS - left);
    if (left > 0 && sound) {
      soundRaf = requestAnimationFrame(update);
    }
  };
  update();
  soundTimer = setTimeout(() => stopSound(), SOUND_MS);
}

function stopSound() {
  if (soundTimer) clearTimeout(soundTimer);
  if (soundRaf) cancelAnimationFrame(soundRaf);
  soundTimer = null;
  soundRaf = null;
  if (sound) {
    sound.stop();
    sound = null;
  }
}

function currentSuLabel(elapsedMs) {
  let t = (elapsedMs / 1000) % SU_CYCLE_S;
  for (const part of SU_PHRASE) {
    const len = part.s * 0.5 + part.u + part.gap;
    if (t < len) return part.label;
    t -= len;
  }
  return "suuu suuuu suuuu";
}

function pulse(param, start, peak, hold, end) {
  param.setValueAtTime(0.0001, start);
  param.exponentialRampToValueAtTime(peak, start + 0.025);
  param.setValueAtTime(peak, hold);
  param.exponentialRampToValueAtTime(0.0001, end);
}

function createShuuu() {
  const ctx = new AudioContext();
  const duration = SOUND_MS / 1000;
  const t0 = ctx.currentTime;

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const essHigh = ctx.createBiquadFilter();
  essHigh.type = "highpass";
  essHigh.frequency.value = 5500;
  essHigh.Q.value = 0.7;

  const essPeak = ctx.createBiquadFilter();
  essPeak.type = "bandpass";
  essPeak.frequency.value = 7800;
  essPeak.Q.value = 1.4;

  const essGain = ctx.createGain();
  essGain.gain.value = 0.0001;

  const oo = ctx.createOscillator();
  oo.type = "sine";
  oo.frequency.value = 260;
  const oo2 = ctx.createOscillator();
  oo2.type = "sine";
  oo2.frequency.value = 680;
  const ooFilter = ctx.createBiquadFilter();
  ooFilter.type = "lowpass";
  ooFilter.frequency.value = 980;
  const ooGain = ctx.createGain();
  ooGain.gain.value = 0.0001;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.32, t0 + 0.08);
  master.gain.setValueAtTime(0.32, t0 + duration - 0.5);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  noise.connect(essHigh);
  essHigh.connect(essPeak);
  essPeak.connect(essGain);
  essGain.connect(master);

  oo.connect(ooFilter);
  oo2.connect(ooFilter);
  ooFilter.connect(ooGain);
  ooGain.connect(master);

  master.connect(ctx.destination);

  let t = t0;
  const end = t0 + duration;
  while (t < end) {
    for (const part of SU_PHRASE) {
      if (t >= end) break;
      const sEnd = t + part.s;
      const uStart = t + part.s * 0.45;
      const uEnd = Math.min(end, uStart + part.u);
      pulse(essGain.gain, t, 1.15, t + part.s * 0.7, Math.min(end, sEnd + 0.05));
      pulse(ooGain.gain, uStart, 0.42, uStart + part.u * 0.72, uEnd);
      t = uStart + part.u + part.gap;
    }
  }

  return {
    start() {
      noise.start();
      oo.start();
      oo2.start();
    },
    stop() {
      try {
        noise.stop();
        oo.stop();
        oo2.stop();
      } catch {
        /* already stopped */
      }
      ctx.close();
    },
  };
}

function clearWait() {
  if (waitTimer) clearInterval(waitTimer);
  waitTimer = null;
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function show(el) {
  el.hidden = false;
  el.classList.remove("is-hidden");
}

function hide(el) {
  el.hidden = true;
  el.classList.add("is-hidden");
}
