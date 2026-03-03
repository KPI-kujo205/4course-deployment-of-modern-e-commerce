import "dotenv/config";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { logger } from "../logger";
import type { DB } from "./types";
import { getConnectionString } from "./utils/get-connection-string";

const pool = new Pool({
	connectionString: getConnectionString(),
});

pool.on("error", (err) => {
	logger.error(err);
});

const dialect = new PostgresDialect({
	pool: pool,
});

export const db = new Kysely<DB>({
	dialect: dialect,
});

export type { DB };
