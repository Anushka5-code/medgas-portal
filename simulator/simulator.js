'use strict';

/**
 * Medical Gas Simulator — AGGRESSIVE ALERT MODE
 *
 * Each device cycles through scenarios:
 *   - NORMAL      (pressure 50–90, purity 94–98)
 *   - LOW_PRESSURE  burst  (pressure 20–38  for N readings)
 *   - HIGH_PRESSURE burst  (pressure 105–130 for N readings)
 *   - LOW_PURITY    burst  (purity   85–91   for N readings)
 *
 * Alert engine needs 3 consecutive abnormal readings to open an alert.
 * Bursts send 5–8 bad readings in a row to guarantee alert creation.
 * After each burst, device returns to NORMAL to allow resolution,
 * then starts a new scenario.
 */

const axios = require('axios');

// ── Configuration ─────────────────────────────────────────────────────────
const BACKEND_URL = process.env.BACKEND_URL       || 'http://localhost:3001';
const API_KEY     = process.env.SIMULATOR_API_KEY || 'sim-secret-key-2024';
const FAST_MS     = parseInt(process.env.FAST_MS  || '800',  10);  // ms between readings in a burst
const NORMAL_MS   = parseInt(process.env.NORMAL_MS|| '3000', 10);  // ms between normal readings

const DEVICES = ['D001', 'D002', 'D003', 'D004'];

// ── Helpers ────────────────────────────────────────────────────────────────
const rand    = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const pad     = n  => String(n).padStart(2, '0');
const timeStr = d  => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ── Scenario definitions — OXYGEN PURITY ONLY ─────────────────────────────
// Pressure always stays NORMAL (50–90). Only oxygen_purity triggers alerts.
const SCENARIOS = [
  // 1. LOW PURITY — mild dip
  () => ({ pressure: rand(55, 85), oxygen_purity: rand(88, 92), label: '😷 LOW_PURITY (mild)' }),
  // 2. LOW PURITY — severe dip
  () => ({ pressure: rand(55, 85), oxygen_purity: rand(80, 87), label: '🚨 LOW_PURITY (severe)' }),
  // 3. LOW PURITY — critical
  () => ({ pressure: rand(55, 85), oxygen_purity: rand(70, 79), label: '💀 LOW_PURITY (critical)' }),
  // 4. HIGH PURITY — above 99%
  () => ({ pressure: rand(55, 85), oxygen_purity: rand(100, 105), label: '⬆️  HIGH_PURITY' }),
];

// Normal reading generator
const normalReading = () => ({
  pressure:      rand(50, 90),
  oxygen_purity: rand(94, 98),
  label:         '✅ NORMAL',
});

// ── POST a reading ─────────────────────────────────────────────────────────
async function postReading(deviceId, pressure, oxygen_purity) {
  const now     = new Date();
  const payload = {
    device_id:     deviceId,
    pressure,
    oxygen_purity,
    timestamp:     now.toISOString(),
  };

  const label = `${timeStr(now)}  ${deviceId.padEnd(6)}  P:${String(pressure).padEnd(8)} O2:${oxygen_purity}%`;

  try {
    await axios.post(`${BACKEND_URL}/readings`, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    });
    console.log(` ${label}`);
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    console.error(`   ❌ [${deviceId}] POST failed: ${msg}`);
  }
}

// ── Per-device loop ────────────────────────────────────────────────────────
async function runDevice(deviceId, startDelay) {
  await sleep(startDelay); // stagger device starts

  while (true) {
    // ── Phase 1: Normal readings (8–12 readings) ──
    const normalCount = Math.floor(Math.random() * 5) + 8;
    console.log(`\n [${deviceId}] 😌 Normal phase (${normalCount} readings)`);
    for (let i = 0; i < normalCount; i++) {
      const r = normalReading();
      await postReading(deviceId, r.pressure, r.oxygen_purity);
      await sleep(NORMAL_MS);
    }

    // ── Phase 2: Pick a random alert scenario ──
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const burstCount = Math.floor(Math.random() * 4) + 5; // 5–8 abnormal readings
    const sample = scenario();
    console.log(`\n [${deviceId}] ${sample.label} burst (${burstCount} readings) ⚠️`);

    for (let i = 0; i < burstCount; i++) {
      const r = scenario(); // fresh values each time for realism
      await postReading(deviceId, r.pressure, r.oxygen_purity);
      await sleep(FAST_MS);
    }

    // ── Phase 3: Brief recovery (sends enough normals to auto-resolve) ──
    const recoveryCount = 7;
    console.log(`\n [${deviceId}] 🔄 Recovery phase (${recoveryCount} readings)`);
    for (let i = 0; i < recoveryCount; i++) {
      const r = normalReading();
      await postReading(deviceId, r.pressure, r.oxygen_purity);
      await sleep(FAST_MS);
    }
  }
}

// ── Start all devices (staggered) ─────────────────────────────────────────
console.log('\n🏥  Medical Gas Monitor — AGGRESSIVE ALERT SIMULATOR');
console.log(`🌐  Backend : ${BACKEND_URL}`);
console.log(`⚡  Fast delay (burst) : ${FAST_MS}ms`);
console.log(`😴  Normal delay       : ${NORMAL_MS}ms`);
console.log(`📡  Devices : ${DEVICES.join(', ')}`);
console.log(`\n${'─'.repeat(70)}`);
console.log(` Time      Device  Pressure        O2 Purity`);
console.log('─'.repeat(70));

DEVICES.forEach((deviceId, i) => {
  runDevice(deviceId, i * 1500).catch(err =>
    console.error(`💥 Fatal error in ${deviceId}:`, err)
  );
});
