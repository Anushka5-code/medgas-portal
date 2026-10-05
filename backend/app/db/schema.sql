-- =============================================================
-- Medical Gas Monitoring — PostgreSQL Schema v3
-- Adds: alert debounce state, alert_remarks, REMARK_ADDED event
-- All DDL is idempotent (IF NOT EXISTS + DO $$ migrations).
-- =============================================================

-- ── Wards ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wards (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(60)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('DOCTOR','NURSE')),
    ward_id       INTEGER      REFERENCES wards(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ── Devices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    device_id     VARCHAR(20)  PRIMARY KEY,
    ward_id       INTEGER      REFERENCES wards(id) ON DELETE SET NULL,
    bed_label     VARCHAR(100),
    registered_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='devices' AND column_name='ward_id'
    ) THEN
        ALTER TABLE devices ADD COLUMN ward_id   INTEGER REFERENCES wards(id) ON DELETE SET NULL;
        ALTER TABLE devices ADD COLUMN bed_label VARCHAR(100);
    END IF;
END $$;

-- ── Readings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readings (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(20)  NOT NULL REFERENCES devices(device_id),
    pressure      NUMERIC(8,2) NOT NULL,
    oxygen_purity NUMERIC(5,2) NOT NULL DEFAULT 96.0,
    status        VARCHAR(20)  NOT NULL,
    purity_status VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
    timestamp     TIMESTAMPTZ  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_device_ts
    ON readings (device_id, timestamp DESC);

-- ── Alert debounce state (in-memory counters persisted for crash recovery) ──
-- One row per (device_id, parameter). Engine upserts this on every reading.
CREATE TABLE IF NOT EXISTS alert_debounce (
    device_id          VARCHAR(20) NOT NULL,
    parameter          VARCHAR(20) NOT NULL,  -- 'pressure' | 'purity'
    -- open debounce
    abnormal_streak    INTEGER     NOT NULL DEFAULT 0,
    -- close (hysteresis)
    normal_streak      INTEGER     NOT NULL DEFAULT 0,
    normal_since       TIMESTAMPTZ,           -- when the current normal streak started
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, parameter)
);

-- ── Alerts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id                  SERIAL PRIMARY KEY,
    device_id           VARCHAR(20)  NOT NULL REFERENCES devices(device_id),
    alert_type          VARCHAR(20)  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    parameter           VARCHAR(20)  NOT NULL DEFAULT 'pressure',
    initial_value       NUMERIC(8,2) NOT NULL,
    max_value           NUMERIC(8,2) NOT NULL,
    min_value           NUMERIC(8,2) NOT NULL,
    current_value       NUMERIC(8,2) NOT NULL,
    threshold           NUMERIC(8,2) NOT NULL,
    initial_pressure    NUMERIC(8,2) NOT NULL DEFAULT 0,
    max_pressure        NUMERIC(8,2) NOT NULL DEFAULT 0,
    current_pressure    NUMERIC(8,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    acknowledged_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_note   TEXT,
    escalated_at        TIMESTAMPTZ,
    escalated_by        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    escalation_note     TEXT,
    escalation_status   VARCHAR(20)  NOT NULL DEFAULT 'NONE'
                            CHECK (escalation_status IN ('NONE','PENDING','RESPONDED')),
    responded_by        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    responded_at        TIMESTAMPTZ,
    resolved_by         INTEGER      REFERENCES users(id) ON DELETE SET NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='alerts' AND column_name='acknowledged_by'
    ) THEN
        ALTER TABLE alerts
            ADD COLUMN acknowledged_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN acknowledged_note TEXT,
            ADD COLUMN escalated_at      TIMESTAMPTZ,
            ADD COLUMN escalated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN escalation_note   TEXT,
            ADD COLUMN escalation_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
            ADD COLUMN responded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN responded_at      TIMESTAMPTZ,
            ADD COLUMN resolved_by       INTEGER REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alerts_device_status  ON alerts (device_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_parameter      ON alerts (parameter, status);
CREATE INDEX IF NOT EXISTS idx_alerts_escalation     ON alerts (escalation_status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at    ON alerts (resolved_at DESC)  WHERE status = 'RESOLVED';

-- ── Alert readings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_readings (
    id            SERIAL PRIMARY KEY,
    alert_id      INTEGER      NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    pressure      NUMERIC(8,2) NOT NULL DEFAULT 0,
    oxygen_purity NUMERIC(5,2) NOT NULL DEFAULT 96.0,
    timestamp     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_readings_alert
    ON alert_readings (alert_id, timestamp DESC);

-- ── Alert events (audit log) ───────────────────────────────────────────────
-- NOTE: REMARK_ADDED added to the CHECK list; existing rows are unaffected.
CREATE TABLE IF NOT EXISTS alert_events (
    id          SERIAL PRIMARY KEY,
    alert_id    INTEGER     NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    event_type  VARCHAR(20) NOT NULL,
    user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop the old CHECK constraint and re-add with REMARK_ADDED (idempotent)
DO $$
BEGIN
    -- Remove old constraint if it exists (name may vary; find it dynamically)
    DECLARE
        v_cname TEXT;
    BEGIN
        SELECT conname INTO v_cname
        FROM   pg_constraint
        WHERE  conrelid = 'alert_events'::regclass
          AND  contype  = 'c'
          AND  conname  LIKE '%event_type%'
        LIMIT  1;

        IF v_cname IS NOT NULL THEN
            EXECUTE format('ALTER TABLE alert_events DROP CONSTRAINT %I', v_cname);
        END IF;
    END;

    -- Add updated constraint (includes REMARK_ADDED)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'alert_events'::regclass
          AND contype  = 'c'
          AND conname  = 'alert_events_event_type_check_v3'
    ) THEN
        ALTER TABLE alert_events
            ADD CONSTRAINT alert_events_event_type_check_v3
            CHECK (event_type IN (
                'CREATED','UPDATED','ACKNOWLEDGED',
                'ESCALATED','AUTO_ESCALATED','RESPONDED',
                'RESOLVED','AUTO_RESOLVED','REMARK_ADDED'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alert_events_alert
    ON alert_events (alert_id, created_at DESC);

-- ── Alert remarks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_remarks (
    id         SERIAL PRIMARY KEY,
    alert_id   INTEGER      NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    role       VARCHAR(10)  NOT NULL,
    text       VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_remarks_alert
    ON alert_remarks (alert_id, created_at ASC);
