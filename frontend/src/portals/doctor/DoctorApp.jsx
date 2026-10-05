/**
 * portals/doctor/DoctorApp.jsx
 * ============================
 * Doctor portal — mounts the real dashboard at /doctor/*.
 * Protected for DOCTOR role only (enforced by ProtectedRoute in App.jsx).
 */
import { useState } from 'react';
import { Shell }            from '../../components/layout/Shell';
import { ToastContainer }   from '../../components/ui/Toast';
import { PageSkeleton }     from '../../components/ui/Skeleton';
import { Overview }         from '../../pages/Overview';
import { Devices }          from '../../pages/Devices';
import { Alerts }           from '../../pages/Alerts';
import { Analytics }        from '../../pages/Analytics';
import { useDashboardData } from '../../hooks/useDashboardData';

export default function DoctorApp() {
  const [activeTab,    setActiveTab]    = useState('overview');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selectedWard, setSelectedWard] = useState(null);  // null = all wards

  const {
    devices, trendData, purityTrend, allReadings, alerts, activities, wards,
    loading, error, connected, lastReceived,
    stats, rpm,
    toasts, dismissToast,
    acknowledgeAlert, resolveAlert, respondAlert,
  } = useDashboardData({ wardId: selectedWard });

  return (
    <>
      <Shell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alerts={alerts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        connected={connected}
        wards={wards}
        selectedWard={selectedWard}
        onWardChange={setSelectedWard}
      >
        {error && (
          <div role="alert" className="mx-5 mt-5 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background:'#FEE2E2', border:'1px solid #FECACA', color:'#991B1B' }}>
            ⚠️ Cannot reach backend — {error}. Make sure FastAPI is running on port 8000.
          </div>
        )}

        {loading && <PageSkeleton />}

        {!loading && activeTab === 'overview' && (
          <Overview
            devices={devices}
            trendData={trendData}
            purityTrend={purityTrend}
            alerts={alerts}
            activities={activities}
            stats={stats}
            connected={connected}
            lastReceived={lastReceived}
            rpm={rpm}
            onRespond={respondAlert}
            onResolve={resolveAlert}
          />
        )}

        {!loading && activeTab === 'devices' && (
          <Devices
            devices={devices}
            alerts={alerts}
            trendData={trendData}
            purityTrend={purityTrend}
            searchQuery={searchQuery}
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
          />
        )}

        {!loading && activeTab === 'alerts' && (
          <Alerts
            alerts={alerts}
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
            searchQuery={searchQuery}
          />
        )}

        {!loading && activeTab === 'analytics' && (
          <Analytics
            allReadings={allReadings}
            trendData={trendData}
            purityTrend={purityTrend}
            alerts={alerts}
          />
        )}
      </Shell>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
