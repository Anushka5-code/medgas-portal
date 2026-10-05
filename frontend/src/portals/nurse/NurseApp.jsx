/**
 * portals/nurse/NurseApp.jsx
 * ==========================
 * Full Nurse Portal — mounts at /nurse/*.
 * Protected for NURSE role only (enforced by ProtectedRoute in App.jsx).
 */
import { useState, useEffect } from 'react';
import { NurseSidebar }  from './components/NurseSidebar';
import { NurseTopBar }   from './components/NurseTopBar';
import { ToastContainer } from '../../components/ui/Toast';
import { PageSkeleton }   from '../../components/ui/Skeleton';
import { WardPage }       from './pages/WardPage';
import { NurseAlerts }    from './pages/NurseAlerts';
import { NurseHistory }   from './pages/NurseHistory';
import { useNurseData }   from './hooks/useNurseData';

export default function NurseApp() {
  const [activeTab,   setActiveTab]   = useState('ward');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed,   setCollapsed]   = useState(false);
  const [soundEnabled,setSoundEnabled]= useState(true);

  // Auto-collapse sidebar below 1024px
  useEffect(() => {
    const mq = window.matchMedia('(max-width:1024px)');
    const h   = (e) => setCollapsed(e.matches);
    setCollapsed(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const {
    devices, alerts, activities, loading, error,
    connected, lastReceived, stats,
    toasts, dismissToast,
    acknowledgeAlert, escalateAlert,
  } = useNurseData({ soundEnabled });

  const activeAlertCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <>
      <div className="min-h-screen bg-[#F4F7FC] relative overflow-hidden flex items-start justify-center p-4 sm:p-6">
        {/* Background decorations */}
        <div className="pointer-events-none absolute top-0 left-0 w-72 h-72 bg-dots opacity-60" aria-hidden="true"/>
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full"
          style={{ background:'radial-gradient(circle, rgba(47,128,237,0.10) 0%, transparent 70%)' }}
          aria-hidden="true"/>

        {/* Floating container */}
        <div className="relative z-10 w-full max-w-[1440px] min-h-[calc(100vh-3rem)] rounded-3xl bg-white overflow-hidden flex"
          style={{ boxShadow:'0 8px 48px rgba(47,128,237,0.10)', border:'1px solid rgba(47,128,237,0.10)' }}>

          <NurseSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            alertCount={activeAlertCount}
            connected={connected}
            collapsed={collapsed}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Offline warning banner */}
            {!connected && !loading && (
              <div className="px-6 py-2.5 text-xs font-semibold text-center"
                style={{ background:'#FEF2F2', color:'#DC2626', borderBottom:'1px solid #FECACA' }}>
                ⚠ Connection lost — readings may be outdated
              </div>
            )}

            <NurseTopBar
              alerts={alerts}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(v => !v)}
            />

            <main className="flex-1 overflow-y-auto bg-[#F4F7FC]">
              {error && (
                <div role="alert" className="mx-5 mt-5 px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ background:'#FEE2E2', border:'1px solid #FECACA', color:'#991B1B' }}>
                  ⚠️ Cannot reach backend — {error}. Make sure FastAPI is running on port 8000.
                </div>
              )}

              {loading && <PageSkeleton/>}

              {!loading && activeTab === 'ward' && (
                <WardPage
                  devices={devices}
                  alerts={alerts}
                  activities={activities}
                  stats={stats}
                  lastReceived={lastReceived}
                  onAcknowledge={acknowledgeAlert}
                  onEscalate={escalateAlert}
                  searchQuery={searchQuery}
                />
              )}

              {!loading && activeTab === 'alerts' && (
                <NurseAlerts
                  alerts={alerts}
                  onAcknowledge={acknowledgeAlert}
                  onEscalate={escalateAlert}
                  searchQuery={searchQuery}
                />
              )}

              {!loading && activeTab === 'history' && (
                <NurseHistory/>
              )}
            </main>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>
    </>
  );
}
