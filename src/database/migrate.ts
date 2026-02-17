import * as fs from "fs";
import * as path from "path";
import { getPool } from "./connection";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function runMigrations() {
  const pool = getPool();
  const migrationsDir = path.join(__dirname, "migrations");

  try {
    console.log("Starting database migrations...");

    // Get all migration files sorted by name
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files`);

    // Run each migration in order
    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await pool.query(sql);
      console.log(`✓ Migration ${file} completed successfully`);
    }

    console.log("\n✓ All migrations completed successfully");

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("\nCreated tables:");
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
