import asyncio, asyncpg, os
from dotenv import load_dotenv
load_dotenv()

async def check():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "medical_gas_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    schema = open("app/db/schema.sql").read()
    await conn.execute(schema)
    tables = await conn.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    )
    print("Tables:", [r["tablename"] for r in tables])
    await conn.close()
    print("Schema applied OK")

asyncio.run(check())
