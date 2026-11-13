-- Clean up all pressure-related alerts and debounce state
-- This removes all HIGH_PRESSURE and LOW_PRESSURE alerts from the system

BEGIN;

-- Delete pressure alert events
DELETE FROM alert_events 
WHERE alert_id IN (
    SELECT id FROM alerts 
    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
);

-- Delete pressure alert readings
DELETE FROM alert_readings 
WHERE alert_id IN (
    SELECT id FROM alerts 
    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
);

-- Delete pressure alert remarks
DELETE FROM alert_remarks 
WHERE alert_id IN (
    SELECT id FROM alerts 
    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
);

-- Delete all pressure alerts
DELETE FROM alerts 
WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE');

-- Reset pressure debounce state (keep purity state)
DELETE FROM alert_debounce 
WHERE parameter = 'pressure';

COMMIT;

-- Show remaining alerts (should only be purity alerts)
SELECT id, device_id, alert_type, status, parameter, created_at 
FROM alerts 
ORDER BY created_at DESC 
LIMIT 20;
