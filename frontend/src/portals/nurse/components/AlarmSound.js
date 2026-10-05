/**
 * AlarmSound.js — Web Audio API alarm utilities
 * playLowTone()  : single soft beep for LOW alerts
 * playHighAlarm(): repeated urgent alarm for HIGH alerts (stops after 5 repeats)
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function beep({ freq = 880, duration = 0.18, gain = 0.35, type = 'sine', delay = 0 } = {}) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(0, ctx.currentTime + delay);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    vol.gain.linearRampToValueAtTime(0,    ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop (ctx.currentTime + delay + duration + 0.02);
  } catch (_) { /* AudioContext not available (SSR, test) */ }
}

export function playLowTone() {
  beep({ freq: 660, duration: 0.25, gain: 0.25 });
}

export function playHighAlarm() {
  // 5 rapid double-beeps
  for (let i = 0; i < 5; i++) {
    beep({ freq: 1040, duration: 0.12, gain: 0.5,  delay: i * 0.35 });
    beep({ freq: 880,  duration: 0.12, gain: 0.45, delay: i * 0.35 + 0.15 });
  }
}

export function requestNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}
