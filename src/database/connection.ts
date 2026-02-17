import { Pool, PoolConfig } from "pg";

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "saba",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "saba_db",
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };
    pool = new Pool(config);

    pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
    });

    console.log(
      `PostgreSQL pool created: ${config.host}:${config.port}/${config.database}`
    );
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log("PostgreSQL pool closed");
  }
}
