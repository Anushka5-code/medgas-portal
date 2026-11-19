Portal guide: showing the tablet's gauge data
Oxygen Level Detection and Monitoring System. For the portal / front-end developer. Tablet app version
0.1.0, 16 Nov 2026.
1. What the tablet does
A tablet is mounted in front of a medical-gas panel. Its camera reads every pressure gauge about once a
second, compares each one with the safe range of its gas, and sends the result to your portal as JSON.
The tablet has no alarm of its own and does not show history: raising alarms and showing data to staff
is the portal's job.
2. What the portal must provide
- One address that accepts an HTTP POST with a JSON body (Content-Type:
application/json), for example http://192.168.1.20:8080/api/readings.
- Reply with any 2xx status once the message is stored. On any other reply, or no reply within about 8
seconds, the tablet keeps the message and sends it again later.
- Reachable from the tablet's Wi-Fi. A plain http:// address on the local network is fine.
- Store every message as it arrives, then update the screens from the stored data.
Send the address to Mithun; it is typed into the tablet's Settings screen. No code change is needed.
3. When messages arrive
Messages are sent on events, not every second. Expect a quiet stream with bursts when something
changes.
event When it is sent
status_change The panel status, or one gauge's status, changed and stayed changed for 3 readings in a row.
Also the first reading after the app starts.
value_change A gauge moved by at least 5 % of its safe range since the last message.
heartbeat Nothing changed for 30 seconds. Carries the current readings. It means: the tablet is alive.
test Someone pressed 'Send a test message' in the tablet's Settings. Only device_id, timestamp,
event and alert_status are present. Do not store it as a reading.
4. The message
{
 "device_id": "tab-01",
 "timestamp": "2026-11-16T20:45:08+05:30",
 "seq": 42,
 "event": "status_change",
 "alert_status": "CRITICAL",
 "confidence_pct": 97,
 "reading": 2.52, "unit": "kg/cm2", "gas": "OXYGEN",
 "gauges": [
 {"gauge_id": "tab-01-g1", "number": 1, "kind": "analog", "gas": "OXYGEN",
 "reading": 2.52, "unit": "kg/cm2", "status": "CRITICAL", "status_text": "CRITICALLY LOW",
 "safe_low": 3.5, "safe_high": 5.5, "safe_critical": 3.0, "safe_buffer": 0.2,
 "confidence_pct": 96},
 {"gauge_id": "tab-01-g3", "number": 3, "kind": "analog", "gas": "VACUUM",
 "reading": 579.4, "unit": "mmHg", "status": "OK", "status_text": "within the safe range",
 "safe_low": 300.0, "safe_high": null, "safe_critical": 200.0, "safe_buffer": 25.0,
 "confidence_pct": 95}
 ],
 "lamps": ["red"],
 "reasons": ["#1 OXYGEN needle reads 2.52 kg/cm2 (safe range 3.5-5.5 kg/cm2) -> CRITICALLY LOW",
 "lit RED lamp (LOW / ALARM)"],
 "app_version": "0.1.0"
}
Portal guide - Oxygen Level Detection and Monitoring System Page 2
Field Meaning
device_id The tablet = one camera in front of one panel. Use it as the Device Number of the
project document.
timestamp When the frame was read, with the time-zone offset. Use this, not the arrival time.
seq Counts up by 1 for every message from this tablet, also across restarts.
alert_status NORMAL, CRITICAL or UNREADABLE. The state of the whole panel (see section
5).
reading, unit, gas The main (oxygen) gauge repeated at the top level, for a simple one-number view.
Can be null.
confidence_pct How sure the reader is of alert_status, 0 to 99.
gauges[] Every needle gauge and digital display in view, numbered left to right.
gauges[].kind analog (needle dial) or digital (number display). A digital display has gas = null.
gauges[].status The gauge compared with its own safe range (see section 5).
gauges[].safe_low,
safe_high, safe_critical,
safe_buffer
The limits the tablet used, in that gauge's own unit. null = no limit on that side.
lamps Colours of the lit status lamps seen on the panel: green, red, amber.
reasons Plain-English sentences explaining the result. Good for an alert's detail view.
5. Statuses and how to show them
Panel: alert_status
alert_status Meaning Suggested display
NORMAL Every gauge is inside its safe range and no warning lamp is lit. Green
CRITICAL A gauge is outside its safe range, or a red / amber lamp is lit.
This is the 'Critical' device state of the project document.
Red, alarm sound, alert record
UNREADABLE No gauge or lamp could be read: camera blocked, moved,
dark, or no panel in view.
Grey or amber, and treat as an
alert if it lasts
Each gauge: gauges[].status
status Meaning Suggested display
OK Inside the safe range. Green
NEAR_LOW,
NEAR_HIGH
Still inside the safe range, but within the small buffer
next to a limit. An early warning.
Amber
LOW Below safe_low. Red
CRITICAL Below safe_critical. Red, highest priority
HIGH Above safe_high. Red
READ The value was read, but no safe range is set for this
gas.
Neutral, show the number only
UNCERTAIN The gauge was found but could not be read reliably.
reading may be null.
Grey, show '--'
6. Ten things to keep in mind
Portal guide - Oxygen Level Detection and Monitoring System Page 3
1 Do not work out thresholds in the portal. The tablet has already compared every reading with its
limits. Show alert_status and gauges[].status as they are, and show the limits from the safe_ fields of
the same message.
2 The portal must raise the alarm. The tablet is silent. Sound the alarm and create an alert record
when a message arrives with alert_status CRITICAL. Close the alert when a later message is
NORMAL.
3 Detect a dead tablet yourself. A tablet that is off, offline or closed sends nothing, so it cannot tell you.
If no message (not even a heartbeat) has arrived from a device for about 90 seconds, show 'Tablet
offline' and treat it as an alert.
4 UNREADABLE is not 'nothing to show'. It means nobody is watching the gauge. Show it clearly; if it
lasts more than a minute or two, raise an alert.
5 Old messages can arrive late. When Wi-Fi comes back, the tablet sends everything it stored, oldest
first, each with its original timestamp. Store them all for history and charts, but only sound an alarm for
the newest state.
6 The same message can arrive twice (the tablet retries when it does not see your reply). Ignore a
message whose device_id + seq you already have.
7 A jump in seq means lost messages. Worth showing in an admin view; do not treat it as an alert.
8 Draw charts as steps, not as smooth lines. Messages come only on change or every 30 seconds,
so between two points the value was 'about the same', not sloping. Use each gauge's own unit:
pressure is in kg/cm2, vacuum in mmHg, so they need separate axes or separate charts.
9 Expect null and a changing list. reading, gas, unit and the safe_ fields can be null, and gauges[] can
be empty or shorter than last time when a gauge is lost from view. A gauge's number is its left-to-right
position, so it can shift if a gauge to its left disappears: when you match gauges across messages, use
gas together with number.
10 Low confidence means 'go and look'. At confidence_pct 50 or below, or when a reason says the
needle and lamp disagree, show the alert with a 'check the panel' note instead of a firm statement.
7. Portal features in the project document, and the data that feeds them
Portal feature Use
Device list / Device Numbers device_id. A new device_id appearing = a new tablet. Keep a name and location
for each in the portal.
Live view The newest message per device: alert_status, then one tile per entry of gauges[]
with gas, reading, unit, status and safe range.
Active alerts Open an alert on a CRITICAL status_change (and on lasting UNREADABLE or
tablet offline). Show reasons[] as the detail.
Alert history Keep every alert with its start time, end time (first NORMAL after it), worst status
and the readings.
Incident notes Portal-only data: a note, who wrote it and when, attached to an alert. Nothing is
needed from the tablet.
Priority queue of unattended
alerts
Order by severity, then by how long unacknowledged. Suggested severity: gauge
CRITICAL, then LOW / HIGH, then tablet offline / UNREADABLE, then
NEAR_LOW / NEAR_HIGH.
Charts: alert frequency Count of alerts per day or week per device, from the alert history.
Charts: device uptime Share of time with a message at least every 90 seconds, from the heartbeats.
Charts: readings reading over time per gauge, with safe_low and safe_high drawn as lines.
Portal guide - Oxygen Level Detection and Monitoring System Page 4
One difference from the project document. The document says managers change the upper and
lower thresholds in the portal. Today the thresholds are set on the tablet (its Settings screen) and the
portal only receives them in the safe_ fields. If thresholds must be edited in the portal, the tablet needs a
way to fetch them: tell Mithun early, because both sides have to agree on that address and format.
8. Testing without the tablet
Save the message from section 4 as sample.json and post it to your own endpoint:
curl -X POST http://localhost:8080/api/readings -H "Content-Type: application/json" -d @sample.json
In the project repository (github.com/mithun2k51124/o2):
- docs/portal_payload.md: the same message description, kept up to date with the app.
- android/tools/test_portal.py: a tiny stand-in portal that prints and saves every message. Run
it to see real messages from the tablet before your own portal is ready.
With the tablet: open Settings, type your address, press Send a test message. The tablet shows whether
your portal accepted it.
9. What to send back to Mithun
1 The portal address the tablet should post to.
2 Any field you need renamed or added. It is a small change on the tablet, easier now than later.
3 Whether the portal needs a password or key with each message. Today the tablet sends none.
4 Whether thresholds must be editable in the portal (see the note in section 7).
The safe-range numbers in the examples (3.5 to 5.5 kg/cm2, vacuum at least 300 mmHg) are placeholders until the hospital
confirms them. The portal does not depend on them: it shows whatever each message carries.