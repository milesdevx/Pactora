import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connectDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database is not configured");
  return drizzle(postgres(connectionString, { prepare: false, max: 3, connect_timeout: 5 }), { schema });
}

export type Database = ReturnType<typeof connectDatabase>;
let connection: Database | undefined;
// Configuration is checked on access, not when Next imports route modules at build time.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    connection ??= connectDatabase();
    const value = Reflect.get(connection, property);
    return typeof value === "function" ? value.bind(connection) : value;
  },
});
