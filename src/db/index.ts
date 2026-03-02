import "dotenv/config";
import { getConnectionString } from "./utils/get-connection-string";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "./types";

const dialect = new PostgresDialect({
	pool: async () =>
		new Pool({
			connectionString: getConnectionString(),
		}),
});

export const db = new Kysely<DB>({
	dialect: dialect,
});

export type { DB };
