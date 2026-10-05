import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../api/client';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { playLowTone, playHighAlarm, requestNotification } from '../components/AlarmSound';
import { PRESSURE_MIN, PRESSURE_MAX, PURITY_MIN, PURITY_MAX } from '../../../config';

function classify(v, min, max) {
  if (v == null || isNaN(v)) return 'UNKNOWN';
  if (v < min) return 'LOW';
  if (v > max) return 'HIGH';
  return 'NORMAL';
}
function overallStatus(pStat, oStat) {
  if (pStat === 'HIGH' || oStat === 'HIGH') return 'HIGH';
  if (pStat === 'LOW'  || oStat === 'LOW')  return 'LOW';
  if (pStat === 'NORMAL' && oStat === 'NORMAL') return 'NORMAL';
  return 'UNKNOWN';
}
function normAlert(a) {
  if (!a) return a;
  return {
    ...a,
    started_at:    a.started_at    ?? a.created_at,
    current_value: a.current_value ?? a.current_pressure ?? null,
    max_value:     a.max_value     ?? a.max_pressure     ?? null,
    escalation_status: a.escalation_status ?? 'NONE',
  };
}
function safeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function makeActivity(type, deviceId, message) {
  return { id: Date.now() + Math.random(), type, deviceId, message, time: new Date() };
}

export function useNurseData({ soundEnabled = true } = {}) {
  const [devices,      setDevices]      = useState({});
  const [alerts,       setAlerts]       = useState([]);
  const [activities,   setActivities]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastReceived, setLastReceived] = useState(null);
  const [toasts,       setToasts]       = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [{ id, type, message }, ...t].slice(0, 5));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const pushActivity = useCallback((item) => setActivities(p => [item, ...p].slice(0, 30)), []);

  // Initial load
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [devList, readings, alertList] = await Promise.all([
        api.getDevices(),
        api.getReadings({ limit: 200 }),
        api.getAlerts(),
      ]);

      const devMap = {};
      for (const d of devList) {
        devMap[d.device_id] = {
          id: d.device_id, ward_id: d.ward_id,
          ward_name: d.ward_name, bed_label: d.bed_label,
          current_pressure: null, pressure_status: 'UNKNOWN',
          current_purity:   null, purity_status:   'UNKNOWN',
          status: 'UNKNOWN', last_updated: null,
          sparkline_p: [], sparkline_o: [],
        };
      }

      const sorted = [...readings].sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp));
      for (const r of sorted) {
        const d = devMap[r.device_id]; if (!d) continue;
        const pStat = classify(r.pressure,      PRESSURE_MIN, PRESSURE_MAX);
        const oStat = classify(r.oxygen_purity, PURITY_MIN,   PURITY_MAX);
        d.current_pressure = r.pressure;
        d.current_purity   = r.oxygen_purity ?? null;
        d.pressure_status  = pStat;
        d.purity_status    = oStat;
        d.status           = overallStatus(pStat, oStat);
        d.last_updated     = r.timestamp;
        d.sparkline_p      = [...d.sparkline_p, r.pressure].slice(-20);
        if (r.oxygen_purity != null)
          d.sparkline_o    = [...d.sparkline_o, r.oxygen_purity].slice(-20);
      }

      setDevices(devMap);
      setAlerts(alertList.map(normAlert));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Periodic alert refresh
  useEffect(() => {
    const id = setInterval(() => {
      api.getAlerts().then(l => setAlerts(l.map(normAlert))).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // WS handler
  const handleWs = useCallback((evt) => {
    let msg; try { msg = JSON.parse(evt.data); } catch { return; }
    const { event } = msg;

    if (event === 'new_reading') {
      const r = msg.reading; if (!r) return;
      const did = r.device_id;
      const p   = parseFloat(r.pressure);
      const o   = parseFloat(r.oxygen_purity);
      if (isNaN(p)) return;

      const pStat   = classify(p, PRESSURE_MIN, PRESSURE_MAX);
      const oStat   = isNaN(o) ? 'UNKNOWN' : classify(o, PURITY_MIN, PURITY_MAX);
      const overall = overallStatus(pStat, oStat);

      setLastReceived(new Date());
      setDevices(prev => {
        const d = prev[did];
        if (!d) return prev;
        return { ...prev, [did]: {
          ...d,
          current_pressure: p, pressure_status: pStat,
          current_purity:   isNaN(o) ? d.current_purity : o,
          purity_status:    oStat, status: overall,
          last_updated:     r.timestamp || new Date().toISOString(),
          sparkline_p:      [...(d.sparkline_p||[]), p].slice(-20),
          sparkline_o:      isNaN(o) ? (d.sparkline_o||[]) : [...(d.sparkline_o||[]), o].slice(-20),
        }};
      });

      if (Array.isArray(msg.alerts)) msg.alerts.forEach(ae => handleAlertEvt(ae));
    }

    if (['alert_created','alert_updated','alert_resolved','alert_acknowledged',
         'alert_escalated','alert_responded'].includes(event)) {
      handleAlertEvt(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, pushToast, pushActivity]);

  const handleAlertEvt = useCallback(async (msg) => {
    const { event, alert_id: alertId, device_id: did, parameter } = msg;
    const pl = parameter === 'purity' ? 'O₂ Purity' : 'Pressure';

    if (event === 'alert_created') {
      try {
        const fresh = await api.getAlerts();
        setAlerts(fresh.map(normAlert));
        const a = fresh.find(x => x.id === alertId);
        if (a) {
          const isHigh = a.alert_type?.includes('HIGH');
          pushToast(isHigh ? 'danger' : 'warning',
            `🚨 ${did} ${pl}: ${a.alert_type?.replace(/_/g,' ')}`);
          if (soundEnabled) { isHigh ? playHighAlarm() : playLowTone(); }
          if (isHigh) requestNotification(`HIGH ${pl} alert`, `${did} — ${a.alert_type}`);
          pushActivity(makeActivity('alert_created', did, `${did} ${pl} alert: ${a.alert_type?.replace(/_/g,' ')}`));
        }
      } catch {}
    } else if (event === 'alert_resolved') {
      setAlerts(p => p.map(a => a.id===alertId ? {...a, status:'RESOLVED', resolved_at:new Date().toISOString()} : a));
      pushToast('success', `✅ ${did} ${pl} alert resolved`);
      pushActivity(makeActivity('alert_resolved', did, `${did} ${pl} alert auto-resolved`));
    } else if (event === 'alert_acknowledged') {
      setAlerts(p => p.map(a => a.id===alertId ? {...a, status:'ACKNOWLEDGED', acknowledged_at:new Date().toISOString()} : a));
      pushActivity(makeActivity('alert_acknowledged', did, `${did} ${pl} alert acknowledged`));
    } else if (event === 'alert_escalated') {
      setAlerts(p => p.map(a => a.id===alertId ? {...a, escalation_status:'PENDING', escalated_at:new Date().toISOString()} : a));
      pushActivity(makeActivity('alert_escalated', did, `${did} ${pl} escalated to doctor`));
    } else if (event === 'alert_responded') {
      setAlerts(p => p.map(a => a.id===alertId ? {...a, escalation_status:'RESPONDED', responded_at:new Date().toISOString()} : a));
      pushToast('success', `✅ Doctor responded to ${did} escalation`);
      pushActivity(makeActivity('alert_responded', did, `Doctor responded to ${did} escalation`));
    } else if (event === 'alert_updated') {
      setAlerts(p => p.map(a => a.id!==alertId ? a : {
        ...a,
        current_value: msg.value ?? a.current_value,
        max_value:     Math.max(a.max_value ?? 0, msg.value ?? 0),
      }));
    }
  }, [soundEnabled, pushToast, pushActivity]);

  const { connected } = useWebSocket(handleWs);

  const acknowledgeAlert = useCallback(async (id, note) => {
    try {
      const u = await api.post(`/alerts/${id}/acknowledge`, { note });
      setAlerts(p => p.map(a => a.id===id ? normAlert(u) : a));
      pushToast('success', 'Alert acknowledged');
    } catch (e) { pushToast('danger', `Failed: ${e.message}`); throw e; }
  }, [pushToast]);

  const escalateAlert = useCallback(async (id, note) => {
    try {
      const u = await api.post(`/alerts/${id}/escalate`, { note });
      setAlerts(p => p.map(a => a.id===id ? normAlert(u) : a));
      pushToast('warning', 'Escalated to doctor');
    } catch (e) { pushToast('danger', `Failed: ${e.message}`); throw e; }
  }, [pushToast]);

  const devList     = Object.values(devices);
  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const stats = {
    total:  devList.length,
    normal: devList.filter(d => d.status === 'NORMAL').length,
    low:    devList.filter(d => d.status === 'LOW').length,
    high:   devList.filter(d => d.status === 'HIGH').length,
    activeAlerts: activeCount,
  };

  return {
    devices, alerts, activities, loading, error,
    connected, lastReceived, stats,
    toasts, pushToast, dismissToast,
    acknowledgeAlert, escalateAlert, reload: fetchAll,
  };
}
