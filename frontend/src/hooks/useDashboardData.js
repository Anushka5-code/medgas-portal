import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { useWebSocket } from './useWebSocket';

const DEVICE_IDS    = ['D001', 'D002', 'D003', 'D004'];
const TREND_BUCKETS = 30;

const P_MIN = 40, P_MAX = 100;
const O_MIN = 93, O_MAX = 99;

function classifyPressure(v) {
  if (v === null || v === undefined || isNaN(v)) return 'UNKNOWN';
  if (v < P_MIN) return 'LOW';
  if (v > P_MAX) return 'HIGH';
  return 'NORMAL';
}
function classifyPurity(v) {
  if (v === null || v === undefined || isNaN(v)) return 'UNKNOWN';
  if (v < O_MIN) return 'LOW';
  if (v > O_MAX) return 'HIGH';
  return 'NORMAL';
}
function overallStatus(pStat, oStat) {
  if (pStat === 'HIGH' || oStat === 'HIGH') return 'HIGH';
  if (pStat === 'LOW'  || oStat === 'LOW')  return 'LOW';
  if (pStat === 'NORMAL' && oStat === 'NORMAL') return 'NORMAL';
  return 'UNKNOWN';
}

function normaliseAlert(a) {
  if (!a) return a;
  const raw = a.alert_type || '';
  let alert_type = raw;
  if (raw === 'HIGH_PRESSURE') alert_type = 'HIGH_PRESSURE';
  if (raw === 'LOW_PRESSURE')  alert_type = 'LOW_PRESSURE';
  if (raw === 'LOW_PURITY')    alert_type = 'LOW_PURITY';
  if (raw === 'HIGH_PURITY')   alert_type = 'HIGH_PURITY';

  const parameter = a.parameter ||
    (raw.includes('PRESSURE') ? 'pressure' : raw.includes('PURITY') ? 'purity' : 'pressure');

  const current = a.current_value ?? a.current_pressure ?? a.initial_value ?? a.initial_pressure ?? null;
  const max     = a.max_value     ?? a.max_pressure     ?? current;
  const min     = a.min_value     ?? current;

  return {
    ...a,
    alert_type,
    parameter,
    started_at:       a.started_at ?? a.created_at,
    current_value:    current,
    max_value:        max,
    min_value:        min,
    current_pressure: a.current_pressure ?? a.current_value ?? null,
  };
}

function safeTimeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function makeActivity(type, deviceId, message, extra = {}) {
  return { id: Date.now() + Math.random(), type, deviceId, message, time: new Date(), ...extra };
}

export function useDashboardData({ wardId } = {}) {
  const [devices,      setDevices]      = useState({});
  const [trendData,    setTrendData]    = useState([]);
  const [purityTrend,  setPurityTrend]  = useState([]);
  const [allReadings,  setAllReadings]  = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [activities,   setActivities]   = useState([]);
  const [wards,        setWards]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastReceived, setLastReceived] = useState(null);
  const [toasts,       setToasts]       = useState([]);

  const readingCountRef = useRef(0);
  const windowStartRef  = useRef(Date.now());

  const pushToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [{ id, type, message }, ...t].slice(0, 5));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const pushActivity = useCallback((item) => {
    setActivities(prev => [item, ...prev].slice(0, 30));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build ward filter param for doctors
      const wardParam = wardId ? { ward_id: wardId } : {};

      const [devList, readings, alertList, wardList] = await Promise.all([
        api.getDevices(wardParam),
        api.getReadings({ limit: 500, ...(wardId ? { ward_id: wardId } : {}) }),
        api.getAlerts(),
        api.get('/wards'),
      ]);

      setWards(wardList || []);

      const devMap = {};
      for (const d of devList) {
        devMap[d.device_id] = {
          id: d.device_id,
          ward_id: d.ward_id, ward_name: d.ward_name, bed_label: d.bed_label,
          current_pressure: null, pressure_status: 'UNKNOWN',
          current_purity:   null, purity_status:   'UNKNOWN',
          status: 'UNKNOWN', last_updated: null,
          sparkline_p: [], sparkline_o: [],
        };
      }

      const sorted = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const pTrend = {}, oTrend = {};

      for (const r of sorted) {
        const did = r.device_id;
        if (!devMap[did]) continue;
        const pStat = r.status === 'NORMAL' ? 'NORMAL' : r.status === 'HIGH_PRESSURE' ? 'HIGH' : 'LOW';
        const oStat = r.purity_status === 'NORMAL' ? 'NORMAL' : r.purity_status === 'HIGH_PURITY' ? 'HIGH' : 'LOW';
        devMap[did].current_pressure = r.pressure;
        devMap[did].current_purity   = r.oxygen_purity ?? null;
        devMap[did].pressure_status  = pStat;
        devMap[did].purity_status    = oStat;
        devMap[did].status           = overallStatus(pStat, oStat);
        devMap[did].last_updated     = r.timestamp;
        devMap[did].sparkline_p      = [...devMap[did].sparkline_p, r.pressure].slice(-20);
        if (r.oxygen_purity != null)
          devMap[did].sparkline_o    = [...devMap[did].sparkline_o, r.oxygen_purity].slice(-20);

        const label = safeTimeLabel(r.timestamp);
        if (!label) continue;
        if (!pTrend[label]) pTrend[label] = { time: label };
        pTrend[label][did] = r.pressure;
        if (!oTrend[label]) oTrend[label] = { time: label };
        if (r.oxygen_purity != null) oTrend[label][did] = r.oxygen_purity;
      }

      setDevices(devMap);
      setTrendData(Object.values(pTrend).slice(-TREND_BUCKETS));
      setPurityTrend(Object.values(oTrend).slice(-TREND_BUCKETS));
      setAllReadings(sorted);
      setAlerts(alertList.map(normaliseAlert));

      const seed = alertList.slice(0, 8).map(a => {
        const na = normaliseAlert(a);
        return makeActivity(
          na.status === 'RESOLVED' ? 'alert_resolved' : 'alert_created',
          na.device_id,
          `${na.device_id} — ${na.alert_type.replace('_', ' ')} (${na.status.toLowerCase()})`,
          { alertType: na.alert_type }
        );
      });
      setActivities(seed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [wardId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(() => {
      api.getAlerts().then(list => setAlerts(list.map(normaliseAlert))).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const handleWsMessage = useCallback((evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch (_) { return; }
    const { event } = msg;

    if (event === 'new_reading') {
      const r = msg.reading;
      if (!r) return;
      const did      = r.device_id;
      const pressure = parseFloat(r.pressure);
      const purity   = parseFloat(r.oxygen_purity);
      if (isNaN(pressure)) return;

      const pStat   = classifyPressure(pressure);
      const oStat   = isNaN(purity) ? 'UNKNOWN' : classifyPurity(purity);
      const overall = overallStatus(pStat, oStat);

      readingCountRef.current++;
      setLastReceived(new Date());

      setDevices(prev => {
        const d       = prev[did] || { id: did, sparkline_p: [], sparkline_o: [] };
        const prevOv  = d.status;
        const updated = {
          ...d,
          current_pressure: pressure,
          current_purity:   isNaN(purity) ? d.current_purity : purity,
          pressure_status:  pStat,
          purity_status:    oStat,
          status:           overall,
          last_updated:     r.timestamp || new Date().toISOString(),
          sparkline_p:      [...(d.sparkline_p || []), pressure].slice(-20),
          sparkline_o:      isNaN(purity) ? (d.sparkline_o || []) : [...(d.sparkline_o || []), purity].slice(-20),
        };
        if (prevOv !== 'UNKNOWN' && prevOv !== overall) {
          if (overall !== 'NORMAL') {
            pushActivity(makeActivity('reading', did,
              `${did} went ${overall}: P=${pressure.toFixed(1)} PSI, O₂=${isNaN(purity) ? '—' : purity.toFixed(1)}%`));
          } else {
            pushActivity(makeActivity('alert_resolved', did,
              `${did} returned to NORMAL: P=${pressure.toFixed(1)} PSI, O₂=${isNaN(purity) ? '—' : purity.toFixed(1)}%`));
          }
        }
        return { ...prev, [did]: updated };
      });

      const label = safeTimeLabel(r.timestamp || new Date().toISOString());
      if (label) {
        setTrendData(prev => {
          const last = prev[prev.length - 1];
          if (last?.time === label) return [...prev.slice(0, -1), { ...last, [did]: pressure }].slice(-TREND_BUCKETS);
          return [...prev, { time: label, [did]: pressure }].slice(-TREND_BUCKETS);
        });
        if (!isNaN(purity)) {
          setPurityTrend(prev => {
            const last = prev[prev.length - 1];
            if (last?.time === label) return [...prev.slice(0, -1), { ...last, [did]: purity }].slice(-TREND_BUCKETS);
            return [...prev, { time: label, [did]: purity }].slice(-TREND_BUCKETS);
          });
        }
      }

      setAllReadings(prev => [...prev,
        { device_id: did, pressure, oxygen_purity: purity, timestamp: r.timestamp,
          status: r.status, purity_status: r.purity_status }
      ].slice(-2000));

      if (Array.isArray(msg.alerts)) {
        msg.alerts.forEach(ae => handleAlertEvent(ae));
      }
    }

    if (['alert_created','alert_updated','alert_resolved','alert_acknowledged',
         'alert_escalated','alert_responded'].includes(event)) {
      handleAlertEvent(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToast, pushActivity]);

  const handleAlertEvent = useCallback(async (msg) => {
    const { event, alert_id: alertId, device_id: deviceId, parameter } = msg;
    const paramLabel = parameter === 'purity' ? 'O₂ Purity' : 'Pressure';

    if (event === 'alert_created') {
      try {
        const fresh = await api.getAlerts();
        setAlerts(fresh.map(normaliseAlert));
        const created = fresh.find(a => a.id === alertId);
        if (created) {
          const na = normaliseAlert(created);
          const toastType = na.alert_type.startsWith('HIGH') ? 'danger' : 'warning';
          pushToast(toastType,
            `🚨 ${deviceId} ${paramLabel}: ${na.alert_type.replace('_', ' ')} — ${Number(msg.value ?? na.current_value).toFixed(1)}`
          );
          pushActivity(makeActivity('alert_created', deviceId,
            `Alert: ${deviceId} ${na.alert_type.replace(/_/g, ' ')} (${paramLabel})`,
            { alertType: na.alert_type, parameter }));
        }
      } catch (_) {}
    } else if (event === 'alert_updated') {
      setAlerts(prev => prev.map(a => a.id !== alertId ? a : {
        ...a,
        current_value:    msg.value ?? a.current_value,
        current_pressure: msg.pressure ?? a.current_pressure,
        max_value:        Math.max(a.max_value ?? 0, msg.value ?? 0),
      }));
    } else if (event === 'alert_resolved') {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'RESOLVED', resolved_at: new Date().toISOString() } : a
      ));
      pushToast('success', `✅ ${deviceId} ${paramLabel} alert resolved`);
      pushActivity(makeActivity('alert_resolved', deviceId,
        `${deviceId} ${paramLabel} alert auto-resolved`, { parameter }));
    } else if (event === 'alert_acknowledged') {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() } : a
      ));
      pushActivity(makeActivity('alert_acknowledged', deviceId,
        `${deviceId} ${paramLabel} alert acknowledged`, { parameter }));
    } else if (event === 'alert_escalated') {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, escalation_status: 'PENDING', escalated_at: new Date().toISOString() } : a
      ));
      pushToast('warning', `⚠️ ${deviceId} ${paramLabel} escalated to doctors`);
      pushActivity(makeActivity('alert_escalated', deviceId,
        `${deviceId} ${paramLabel} alert escalated${msg.auto ? ' (auto)' : ''}`, { parameter }));
    } else if (event === 'alert_responded') {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, escalation_status: 'RESPONDED', responded_at: new Date().toISOString() } : a
      ));
      pushActivity(makeActivity('alert_responded', deviceId,
        `${deviceId} escalation responded by doctor`, { parameter }));
    }
  }, [pushToast, pushActivity]);

  const { connected } = useWebSocket(handleWsMessage);

  const acknowledgeAlert = useCallback(async (id, note = '') => {
    try {
      const updated = await api.post(`/alerts/${id}/acknowledge`, { note });
      setAlerts(prev => prev.map(a => a.id === id ? normaliseAlert(updated) : a));
      pushToast('info', 'Alert acknowledged');
    } catch (e) { pushToast('danger', `Failed: ${e.message}`); }
  }, [pushToast]);

  const resolveAlert = useCallback(async (id, note = '') => {
    try {
      const updated = await api.post(`/alerts/${id}/resolve`, { note });
      setAlerts(prev => prev.map(a => a.id === id ? normaliseAlert(updated) : a));
      pushToast('success', 'Alert resolved');
    } catch (e) { pushToast('danger', `Failed: ${e.message}`); }
  }, [pushToast]);

  const respondAlert = useCallback(async (id, note) => {
    try {
      const updated = await api.post(`/alerts/${id}/respond`, { note });
      setAlerts(prev => prev.map(a => a.id === id ? normaliseAlert(updated) : a));
      pushToast('success', 'Response sent');
    } catch (e) { pushToast('danger', `Failed: ${e.message}`); }
  }, [pushToast]);

  const devList = Object.values(devices);
  const pNormal = devList.filter(d => d.pressure_status === 'NORMAL').length;
  const pLow    = devList.filter(d => d.pressure_status === 'LOW').length;
  const pHigh   = devList.filter(d => d.pressure_status === 'HIGH').length;
  const oNormal = devList.filter(d => d.purity_status === 'NORMAL').length;
  const oLow    = devList.filter(d => d.purity_status === 'LOW').length;
  const oHigh   = devList.filter(d => d.purity_status === 'HIGH').length;

  const activeAlerts   = alerts.filter(a => a.status === 'ACTIVE').length;
  const pressureAlerts = alerts.filter(a => a.parameter === 'pressure' && a.status === 'ACTIVE').length;
  const purityAlerts   = alerts.filter(a => a.parameter === 'purity'   && a.status === 'ACTIVE').length;
  const pendingEscalations = alerts.filter(a => a.escalation_status === 'PENDING').length;

  const elapsed = Math.max((Date.now() - windowStartRef.current) / 60000, 0.017);
  const rpm     = Math.round(readingCountRef.current / elapsed);

  return {
    devices, trendData, purityTrend, allReadings, alerts, activities, wards,
    loading, error, connected, lastReceived,
    stats: {
      total: devList.length || DEVICE_IDS.length,
      pNormal, pLow, pHigh, oNormal, oLow, oHigh,
      normal: devList.filter(d => d.status === 'NORMAL').length,
      low:    devList.filter(d => d.status === 'LOW').length,
      high:   devList.filter(d => d.status === 'HIGH').length,
      activeAlerts, pressureAlerts, purityAlerts, pendingEscalations,
    },
    rpm,
    toasts, pushToast, dismissToast,
    acknowledgeAlert, resolveAlert, respondAlert,
    reload: fetchAll,
  };
}
