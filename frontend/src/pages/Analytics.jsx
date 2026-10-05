import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const DEVICE_COLORS = { D001:'#2F80ED', D002:'#22C55E', D003:'#F5A524', D004:'#F0386B' };
const DEVICES = ['D001','D002','D003','D004'];

function safeDate(raw) {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function Card({ title, subtitle, children, className='' }) {
  return (
    <div className={`bg-white rounded-2xl p-5 flex flex-col gap-4 ${className}`}
      style={{ boxShadow:'0 4px 24px rgba(80,110,180,0.08)' }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs"
      style={{ background:'#fff', border:'1px solid #E8EEFA', boxShadow:'0 8px 24px rgba(80,110,180,0.12)', minWidth:130 }}>
      {label && <p className="mb-2 font-medium" style={{ color:'#8A94A6' }}>{label}</p>}
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color||p.fill||'#2F80ED' }} />
          <span style={{ color:'#1E2A4A' }}>{p.name}</span>
          <span className="ml-auto font-bold" style={{ color:'#1E2A4A' }}>
            {typeof p.value==='number' ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text='Not enough data yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <span style={{ fontSize:22 }}>📊</span>
      <p className="text-xs text-center max-w-xs" style={{ color:'#8A94A6' }}>{text}</p>
    </div>
  );
}

export function Analytics({ allReadings=[], trendData=[], purityTrend=[], alerts=[] }) {

  /* 1. Pressure histogram */
  const pressureHisto = useMemo(() => {
    const bins = {};
    for (let b=0; b<=140; b+=10) bins[b] = { range:`${b}–${b+10}`, count:0 };
    allReadings.forEach(r => {
      const v = parseFloat(r.pressure);
      if (isNaN(v)) return;
      const b = Math.floor(v/10)*10;
      if (bins[b]) bins[b].count++;
    });
    return Object.values(bins);
  }, [allReadings]);

  /* 2. Purity histogram */
  const purityHisto = useMemo(() => {
    const bins = {};
    for (let b=85; b<=100; b+=1) bins[b] = { range:`${b}%`, count:0 };
    allReadings.forEach(r => {
      const v = parseFloat(r.oxygen_purity);
      if (isNaN(v)) return;
      const b = Math.floor(v);
      if (bins[b]) bins[b].count++;
    });
    return Object.values(bins);
  }, [allReadings]);

  /* 3. Alerts over time (LOW/HIGH/PURITY breakdown) */
  const alertsOverTime = useMemo(() => {
    const buckets = {};
    alerts.forEach(a => {
      const d = safeDate(a.started_at || a.created_at);
      if (!d) return;
      const key = `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours()}:00`;
      if (!buckets[key]) buckets[key] = { time:key, Pressure:0, Purity:0 };
      if (a.parameter === 'purity') buckets[key].Purity++;
      else                          buckets[key].Pressure++;
    });
    return Object.values(buckets).sort((a,b)=>a.time.localeCompare(b.time)).slice(-24);
  }, [alerts]);

  /* 4. Alert type split */
  const alertSplit = useMemo(() => [
    { name:'High Pressure', value: alerts.filter(a=>a.alert_type==='HIGH_PRESSURE').length, fill:'#EF4444' },
    { name:'Low Pressure',  value: alerts.filter(a=>a.alert_type==='LOW_PRESSURE').length,  fill:'#F5A524' },
    { name:'High Purity',   value: alerts.filter(a=>a.alert_type==='HIGH_PURITY').length,   fill:'#8B5CF6' },
    { name:'Low Purity',    value: alerts.filter(a=>a.alert_type==='LOW_PURITY').length,    fill:'#F59E0B' },
  ].filter(d=>d.value>0), [alerts]);

  /* 5. Avg pressure + purity per device */
  const deviceStats = useMemo(() => DEVICES.map(id => {
    const rows = allReadings.filter(r => r.device_id===id);
    const pVals = rows.map(r=>parseFloat(r.pressure)).filter(v=>!isNaN(v));
    const oVals = rows.map(r=>parseFloat(r.oxygen_purity)).filter(v=>!isNaN(v));
    return {
      device: id,
      avgP: pVals.length ? +(pVals.reduce((s,v)=>s+v,0)/pVals.length).toFixed(1) : 0,
      avgO: oVals.length ? +(oVals.reduce((s,v)=>s+v,0)/oVals.length).toFixed(1) : 0,
      countP: pVals.length, countO: oVals.length,
    };
  }), [allReadings]);

  /* 6. Time to resolve per device */
  const timeToResolve = useMemo(() => DEVICES.map(id => {
    const res = alerts.filter(a => a.device_id===id && a.status==='RESOLVED' && a.resolved_at && (a.started_at||a.created_at));
    const avg = res.length
      ? res.reduce((s,a) => {
          const start = safeDate(a.started_at||a.created_at);
          const end   = safeDate(a.resolved_at);
          return start && end ? s + Math.max(0, end-start) : s;
        }, 0) / res.length / 60000
      : 0;
    return { device:id, minutes:+avg.toFixed(1), count:res.length };
  }), [alerts]);

  const total = allReadings.length;

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color:'#1E2A4A' }}>Analytics</h2>
          <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>
            {total.toLocaleString()} readings · {alerts.length} alerts · pressure & O₂ purity
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { label:`${total} Readings`, bg:'#EAF3FF', color:'#2F80ED' },
            { label:`${alerts.length} Alerts`, bg:'#FEE2E2', color:'#EF4444' },
            { label:'4 Devices', bg:'#DCFCE7', color:'#16A34A' },
          ].map(p => (
            <div key={p.label} className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background:p.bg, color:p.color }}>{p.label}</div>
          ))}
        </div>
      </div>

      {/* Row 1: histograms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Pressure Distribution" subtitle={`Readings per 10-PSI bucket · ${total} total`}>
          {pressureHisto.every(b=>b.count===0) ? <Empty /> : (
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pressureHisto} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize:9,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill:'#F4F7FC',radius:4 }} />
                  <ReferenceLine x="30–40"   stroke="#F5A524" strokeDasharray="4 2" />
                  <ReferenceLine x="100–110" stroke="#EF4444" strokeDasharray="4 2" />
                  <Bar dataKey="count" name="Readings" radius={[4,4,0,0]} maxBarSize={22}>
                    {pressureHisto.map((e,i) => {
                      const mid = parseInt(e.range);
                      return <Cell key={i} fill={mid<40?'#F5A524':mid>=100?'#EF4444':'#2F80ED'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="O₂ Purity Distribution" subtitle="Readings per 1% bucket (85–100%)">
          {purityHisto.every(b=>b.count===0) ? <Empty /> : (
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purityHisto} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize:9,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill:'#F4F7FC',radius:4 }} />
                  <Bar dataKey="count" name="Readings" radius={[4,4,0,0]} maxBarSize={16}>
                    {purityHisto.map((e,i) => {
                      const v = parseInt(e.range);
                      return <Cell key={i} fill={v<93?'#F59E0B':v>=99?'#8B5CF6':'#22C55E'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Live Pressure Trends" subtitle="All 4 devices">
          {trendData.length < 2 ? <Empty /> : (
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData.slice(-40)} margin={{ top:4,right:8,left:-18,bottom:0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize:9,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0,140]} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} />
                  <ReferenceLine y={40}  stroke="#F5A524" strokeDasharray="5 3" />
                  <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="5 3" />
                  {DEVICES.map(d=>(
                    <Line key={d} type="monotone" dataKey={d} stroke={DEVICE_COLORS[d]}
                      strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Live O₂ Purity Trends" subtitle="All 4 devices">
          {purityTrend.length < 2 ? <Empty /> : (
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={purityTrend.slice(-40)} margin={{ top:4,right:8,left:-18,bottom:0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize:9,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[85,100]} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<Tip />} />
                  <ReferenceLine y={93} stroke="#F5A524" strokeDasharray="5 3" />
                  <ReferenceLine y={99} stroke="#8B5CF6" strokeDasharray="5 3" />
                  {DEVICES.map(d=>(
                    <Line key={d} type="monotone" dataKey={d} stroke={DEVICE_COLORS[d]}
                      strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: alerts over time + type split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Alerts Over Time" subtitle="Pressure vs Purity alerts per hour" className="lg:col-span-2">
          {alertsOverTime.length===0 ? <Empty text="No alerts recorded yet." /> : (
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={alertsOverTime} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize:9,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="Pressure" name="Pressure" stroke="#EF4444" strokeWidth={2} fill="url(#gP)" dot={false} />
                  <Area type="monotone" dataKey="Purity"   name="Purity"   stroke="#8B5CF6" strokeWidth={2} fill="url(#gO)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Alert Type Split" subtitle="All 4 types">
          {alertSplit.length===0 ? <Empty text="No alerts yet." /> : (
            <div className="flex items-center justify-center gap-4" style={{ height:200 }}>
              <div style={{ width:130, height:130, flexShrink:0 }}>
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={alertSplit} cx="50%" cy="50%"
                      innerRadius={36} outerRadius={56} paddingAngle={3}
                      dataKey="value" cornerRadius={4} strokeWidth={0}>
                      {alertSplit.map((e,i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {alertSplit.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background:d.fill }} />
                    <span className="text-xs font-medium" style={{ color:'#1E2A4A' }}>{d.name}</span>
                    <span className="ml-1 text-sm font-bold" style={{ color:d.fill }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: device avg stats + time to resolve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Avg Pressure & Purity per Device" subtitle="Mean values from all readings">
          {deviceStats.every(d=>d.countP===0) ? <Empty /> : (
            <>
              <div style={{ height:180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deviceStats} margin={{ top:4,right:8,left:-20,bottom:0 }} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="device" tick={{ fontSize:11,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill:'#F4F7FC',radius:4 }} />
                    <ReferenceLine y={40}  stroke="#F5A524" strokeDasharray="4 2" />
                    <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="4 2" />
                    <Bar dataKey="avgP" name="Avg PSI" radius={[4,4,0,0]} maxBarSize={20}>
                      {deviceStats.map((e,i) => <Cell key={i} fill={DEVICE_COLORS[e.device]} />)}
                    </Bar>
                    <Bar dataKey="avgO" name="Avg O₂%" radius={[4,4,0,0]} maxBarSize={20} fill="#4FC3F7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {deviceStats.map(d => (
                  <div key={d.device} className="rounded-xl p-2 text-center" style={{ background:'#F4F7FC' }}>
                    <p className="text-[10px] font-bold" style={{ color:DEVICE_COLORS[d.device] }}>{d.device}</p>
                    <p className="text-xs font-bold" style={{ color:'#1E2A4A' }}>{d.avgP} PSI</p>
                    <p className="text-xs font-bold" style={{ color:'#22C55E' }}>{d.avgO}%</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Avg Time to Resolve" subtitle="Minutes from alert creation to resolution">
          {timeToResolve.every(d=>d.count===0) ? (
            <Empty text="No resolved alerts yet — resolve some from the Alerts tab." />
          ) : (
            <>
              <div style={{ height:180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeToResolve} margin={{ top:4,right:8,left:-20,bottom:0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
                    <XAxis dataKey="device" tick={{ fontSize:11,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize:10,fill:'#8A94A6',fontFamily:'Poppins' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill:'#F4F7FC',radius:4 }} />
                    <Bar dataKey="minutes" name="Minutes" radius={[4,4,0,0]} maxBarSize={32}>
                      {timeToResolve.map((e,i) => <Cell key={i} fill={DEVICE_COLORS[e.device]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {timeToResolve.map(d => (
                  <div key={d.device} className="rounded-xl p-2 text-center" style={{ background:'#F4F7FC' }}>
                    <p className="text-[10px] font-bold" style={{ color:DEVICE_COLORS[d.device] }}>{d.device}</p>
                    <p className="text-xs font-bold" style={{ color:'#1E2A4A' }}>{d.minutes>0?`${d.minutes}m`:'—'}</p>
                    <p className="text-[9px]" style={{ color:'#8A94A6' }}>{d.count} resolved</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
