import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
    CREATE TABLE birthdays (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name                 VARCHAR(255),
      telegram_username    VARCHAR(255),
      description          TEXT,
      birth_day            SMALLINT    NOT NULL,
      birth_month          SMALLINT    NOT NULL,
      birth_year           SMALLINT,
      remind_on_day        BOOLEAN     NOT NULL DEFAULT true,
      remind_3_days_before BOOLEAN     NOT NULL DEFAULT false,
      remind_1_week_before BOOLEAN     NOT NULL DEFAULT false,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db);

	await sql`CREATE INDEX idx_birthdays_user_id  ON birthdays(user_id)`.execute(
		db,
	);
	await sql`CREATE INDEX idx_birthdays_month_day ON birthdays(birth_month, birth_day)`.execute(
		db,
	);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS birthdays`.execute(db);
}
