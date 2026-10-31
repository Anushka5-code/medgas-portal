'use strict';

/**
 * Pressure Sensor Simulator
 *
 * Reads pressure_data.csv, groups rows by device_id, then runs each device
 * as an independent loop:
 *   1. Pick a random row from that device's rows
 *   2. Wait a random delay (MIN_DELAY_MS … MAX_DELAY_MS)
 *   3. POST the reading to the backend  →  { device_id, pressure, timestamp }
 *   4. Repeat forever
 *
 * The backend URL and delay range are configurable via environment variables.
 */

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');
const { parse } = require('csv-parse/sync');

// ── Configuration ────────────────────────────────────────────────────────────
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:3001';
const API_KEY      = process.env.SIMULATOR_API_KEY || 'sim-secret-key-2024';
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || '2000',  10);
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || '6000',  10);
const CSV_PATH     = process.env.CSV_PATH
  || path.join(__dirname, '..', 'dataset', 'pressure_data.csv');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a random integer between min and max (inclusive). */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random element from an array. */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Sleep for ms milliseconds. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Determine status label from pressure value. */
function pressureStatus(pressure) {
  if (pressure < 40)  return 'LOW_PRESSURE';
  if (pressure > 100) return 'HIGH_PRESSURE';
  return 'NORMAL';
}

/** Pad single-digit numbers with a leading zero. */
function pad(n) {
  return String(n).padStart(2, '0');
}

/** Format a Date as HH:MM:SS for the console log. */
function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Load & Parse CSV ─────────────────────────────────────────────────────────

console.log(`\n📂  Loading dataset from: ${CSV_PATH}\n`);

const csvContent = fs.readFileSync(CSV_PATH, 'utf8');

const rows = parse(csvContent, {
  columns: true,          // first row is the header
  skip_empty_lines: true,
  trim: true,
  cast: (value, context) => {
    // Cast the pressure column to a float, leave others as strings
    if (context.column === 'pressure') return parseFloat(value);
    return value;
  },
});

// Group rows by device_id  →  { D001: [...], D002: [...], ... }
const deviceMap = {};
for (const row of rows) {
  if (!deviceMap[row.device_id]) deviceMap[row.device_id] = [];
  deviceMap[row.device_id].push(row);
}

const deviceIds = Object.keys(deviceMap).sort();
console.log(`✅  Loaded ${rows.length} rows for devices: ${deviceIds.join(', ')}\n`);
console.log(`🌐  Backend : ${BACKEND_URL}`);
console.log(`⏱️   Delay   : ${MIN_DELAY_MS}ms – ${MAX_DELAY_MS}ms  (random per reading)`);
console.log(`\n${'─'.repeat(65)}`);
console.log(` ${'Time'.padEnd(10)} ${'Device'.padEnd(8)} ${'Pressure'.padEnd(12)} Status`);
console.log('─'.repeat(65));

// ── Per-Device Simulator Loop ────────────────────────────────────────────────

/**
 * Runs forever for a single device:
 *   pick random row → wait → send → repeat
 */
async function runDevice(deviceId) {
  const deviceRows = deviceMap[deviceId];

  while (true) {
    // 1. Pick a random row from this device's data
    const row = pickRandom(deviceRows);

    // 2. Wait a random amount of time (simulates irregular sensor intervals)
    const delay = randomBetween(MIN_DELAY_MS, MAX_DELAY_MS);
    await sleep(delay);

    // 3. Build the payload — always use the CURRENT wall-clock time
    //    so the demo shows live timestamps, not historical CSV timestamps
    const now       = new Date();
    const isoNow    = now.toISOString();
    const status    = pressureStatus(row.pressure);

    // Generate a realistic oxygen purity between 93–99 (with occasional dips)
    const oxygenPurity = parseFloat((93 + Math.random() * 6).toFixed(2));

    const payload = {
      device_id     : deviceId,
      pressure      : row.pressure,
      oxygen_purity : oxygenPurity,
      timestamp     : isoNow,
    };

    // 4. Log to console
    const statusLabel = status === 'NORMAL'
      ? 'NORMAL'
      : `⚠️  ${status}`;

    console.log(
      ` ${timeStr(now).padEnd(10)}` +
      ` ${deviceId.padEnd(8)}` +
      ` ${String(row.pressure).padEnd(12)}` +
      ` ${statusLabel}`
    );

    // 5. POST to backend  (fire-and-forget with error handling)
    try {
      await axios.post(`${BACKEND_URL}/readings`, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });
    } catch (err) {
      const msg = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : err.message;
      console.error(`   ❌ [${deviceId}] POST failed: ${msg}`);
    }
  }
}

// ── Start All Devices ────────────────────────────────────────────────────────

// Stagger the start of each device by 500ms so they don't all fire at once
async function startAll() {
  for (const deviceId of deviceIds) {
    console.log(`🚀  Starting simulator for ${deviceId}`);
    // Deliberately NOT awaiting — each device runs concurrently
    runDevice(deviceId).catch(err =>
      console.error(`💥 Fatal error in ${deviceId} loop:`, err)
    );
    await sleep(500);
  }
  console.log(`\n✅  All ${deviceIds.length} device simulators running.\n`);
}

startAll();
