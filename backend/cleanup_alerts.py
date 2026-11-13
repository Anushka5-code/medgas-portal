#!/usr/bin/env python3
"""
Clean up all pressure-related alerts from the database.
Run this script to remove HIGH_PRESSURE and LOW_PRESSURE alerts.
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup_pressure_alerts():
    # Connect to database
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "medical_gas_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    
    try:
        print("🧹 Cleaning up pressure alerts...")
        
        # Start transaction
        async with conn.transaction():
            # Delete pressure alert events
            events_deleted = await conn.execute("""
                DELETE FROM alert_events 
                WHERE alert_id IN (
                    SELECT id FROM alerts 
                    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
                )
            """)
            print(f"   ✓ Deleted {events_deleted} alert events")
            
            # Delete pressure alert readings
            readings_deleted = await conn.execute("""
                DELETE FROM alert_readings 
                WHERE alert_id IN (
                    SELECT id FROM alerts 
                    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
                )
            """)
            print(f"   ✓ Deleted {readings_deleted} alert readings")
            
            # Delete pressure alert remarks
            remarks_deleted = await conn.execute("""
                DELETE FROM alert_remarks 
                WHERE alert_id IN (
                    SELECT id FROM alerts 
                    WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
                )
            """)
            print(f"   ✓ Deleted {remarks_deleted} alert remarks")
            
            # Delete all pressure alerts
            alerts_deleted = await conn.execute("""
                DELETE FROM alerts 
                WHERE alert_type IN ('HIGH_PRESSURE', 'LOW_PRESSURE')
            """)
            print(f"   ✓ Deleted {alerts_deleted} pressure alerts")
            
            # Reset pressure debounce state
            debounce_deleted = await conn.execute("""
                DELETE FROM alert_debounce 
                WHERE parameter = 'pressure'
            """)
            print(f"   ✓ Deleted {debounce_deleted} pressure debounce entries")
        
        print("\n✅ Cleanup complete!")
        
        # Show remaining alerts
        print("\n📊 Remaining alerts (should only be purity alerts):")
        remaining = await conn.fetch("""
            SELECT id, device_id, alert_type, status, parameter, created_at 
            FROM alerts 
            ORDER BY created_at DESC 
            LIMIT 10
        """)
        
        if remaining:
            for alert in remaining:
                print(f"   - Alert #{alert['id']}: {alert['device_id']} {alert['alert_type']} ({alert['status']})")
        else:
            print("   No alerts in database")
    
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(cleanup_pressure_alerts())
