import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
    CREATE TABLE reminder_logs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      birthday_id UUID        NOT NULL REFERENCES birthdays(id) ON DELETE CASCADE,
      year        SMALLINT    NOT NULL,
      type        VARCHAR(20) NOT NULL,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT reminder_logs_unique UNIQUE (birthday_id, year, type)
    )
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS reminder_logs`.execute(db);
}
