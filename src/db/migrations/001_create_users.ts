import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
	await sql`
    CREATE TABLE users (
      id         BIGINT      PRIMARY KEY,
      username   VARCHAR(255),
      first_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      tg_user_json JSONB NOT NULL
    )
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
	await sql`DROP TABLE IF EXISTS users`.execute(db);
}
