from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────────────────────────
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "medical_gas_db"
    db_user: str = "postgres"
    db_password: str = "postgres"

    # ── Sensor thresholds ────────────────────────────────────────────────────
    pressure_min: float = 40.0
    pressure_max: float = 100.0
    purity_min:   float = 93.0
    purity_max:   float = 99.0

    # ── JWT ──────────────────────────────────────────────────────────────────
    jwt_secret:                str = "change-me-in-production"
    jwt_algorithm:             str = "HS256"
    access_token_expire_hours: int = 8

    # ── Simulator API key ─────────────────────────────────────────────────────
    simulator_api_key: str = "sim-secret-key-2024"

    # ── Alert escalation ─────────────────────────────────────────────────────
    auto_escalate_minutes: int = 3

    # ── Alert debounce (open) ─────────────────────────────────────────────────
    # Alert opens only after this many consecutive abnormal readings
    alert_open_after_readings: int = 3

    # ── Alert hysteresis (close) ──────────────────────────────────────────────
    # Auto-resolve only after this many consecutive NORMAL readings …
    alert_close_after_readings: int = 5
    # … OR after this many seconds of continuous normal (whichever comes first)
    alert_close_after_seconds: int = 20

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
