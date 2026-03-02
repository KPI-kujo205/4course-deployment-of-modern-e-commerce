import "dotenv/config";
import {Kysely, PostgresDialect} from "kysely";
import {defineConfig} from "kysely-ctl";
import {Pool} from "pg";
import {getConnectionString} from "./src/db/utils/get-connection-string";

export default defineConfig({
  kysely: new Kysely({
    dialect: new PostgresDialect({
      pool: async () =>
        new Pool({
          connectionString: getConnectionString(),
        }),
    }),
  }),
  migrations: {
    migrationFolder: "./src/db/migrations",
  },
  seeds: {
    seedFolder: "./src/db/seeds",
  },
});
