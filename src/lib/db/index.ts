import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Plain TCP Postgres (Railway, or any provider). Lazy: no connection until the first query.
// prepare: false keeps it safe behind poolers (PgBouncer / Railway proxy) on serverless.
const client = postgres(process.env.DATABASE_URL ?? "postgres://localhost/settleshort", { max: 5, prepare: false });

export const db = drizzle(client, { schema });
export * from "./schema";
