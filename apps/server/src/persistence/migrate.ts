import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

/** Apply SQL migrations in order. Usage: DATABASE_URL=… npm run migrate -w @sabha/server */
export async function migrate(connectionString: string): Promise<void> {
  const dir = new URL("../../db/migrations/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const file of files) {
      await client.query(await readFile(new URL(file, dir), "utf8"));
      console.log(`applied ${file}`);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  migrate(url).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
