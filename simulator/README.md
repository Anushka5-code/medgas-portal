# Sensor Simulator

Simulates 4 independent pressure sensors (D001–D004) by reading from the
shared CSV dataset and POSTing one reading at a time to the backend at random
intervals — exactly like a real IoT sensor would behave.

## How it works

```
pressure_data.csv
      ↓
Load all rows, group by device_id
      ↓
For each device — run a concurrent loop:
  1. Pick a random row (random pressure event)
  2. Wait a random delay (2s – 6s by default)
  3. POST  →  { device_id, pressure, timestamp }  to /readings
  4. Repeat forever
```

## Quick start

```bash
npm install
npm start
```

## Environment variables (all optional)

| Variable      | Default                    | Description                      |
|---------------|----------------------------|----------------------------------|
| BACKEND_URL   | http://localhost:3001       | Backend base URL                 |
| MIN_DELAY_MS  | 2000                       | Minimum interval between readings |
| MAX_DELAY_MS  | 6000                       | Maximum interval between readings |
| CSV_PATH      | ../dataset/pressure_data.csv | Path to the dataset              |

### Example — faster readings for a live demo

```bash
MIN_DELAY_MS=500 MAX_DELAY_MS=2000 npm start
```

## Payload format sent to backend

```json
{
  "device_id": "D001",
  "pressure": 105.3,
  "timestamp": "2026-10-01T18:55:19.000Z"
}
```

The timestamp is always the current wall-clock time (UTC ISO-8601),
not the CSV timestamp — so the dashboard always shows live times.

## Replacing with a real sensor

When the ECE team delivers a real sensor, just make the microcontroller
POST the same JSON payload to the same `/readings` endpoint.
The backend doesn't know or care whether the data comes from this
simulator or a physical device.
