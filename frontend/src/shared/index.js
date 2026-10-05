// Shared re-exports — nurse and doctor both import from here
// No files are moved; we just re-export from their original locations.
export { StatusPill }     from '../components/ui/StatusPill';
export { ToastContainer } from '../components/ui/Toast';
export { Skeleton, PageSkeleton } from '../components/ui/Skeleton';
export { Drawer }         from '../components/ui/Drawer';
export { Sparkline }      from '../components/charts/Sparkline';
export { useWebSocket }   from '../hooks/useWebSocket';
