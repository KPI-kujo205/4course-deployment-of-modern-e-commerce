import { sql } from "kysely";
import { db } from "@/db";

export type ReminderType = "on_day" | "3_days_before" | "1_week_before";

export interface DueBirthday {
	birthdayId: string;
	userId: string;
	name: string | null;
	telegramUsername: string | null;
	birthDay: number;
	birthMonth: number;
	birthYear: number | null;
	reminderType: ReminderType;
}

/**
 * Get all birthdays due for reminders on a given local date for a specific user.
 *
 * Checks three reminder windows:
 *  - on_day:          birthday matches localDate exactly
 *  - 3_days_before:   birthday is 3 days after localDate
 *  - 1_week_before:   birthday is 7 days after localDate
 *
 * Only returns reminders that have NOT already been logged for the current year
 * (uses a LEFT JOIN against reminder_logs so the dedup happens in SQL).
 */
export async function getDueBirthdays(userId: string, localDate: Date) {
	const year = localDate.getFullYear();

	const offsets = [
		{ days: 0, type: "on_day", flag: "remind_on_day" },
		{ days: 3, type: "3_days_before", flag: "remind_3_days_before" },
		{ days: 7, type: "1_week_before", flag: "remind_1_week_before" },
	] as const;

	const results: DueBirthday[] = [];

	for (const { days, type, flag } of offsets) {
		const target = new Date(localDate);
		target.setDate(target.getDate() + days);
		const targetMonth = target.getMonth() + 1; // JS months are 0-indexed
		const targetDay = target.getDate();

		const rows = await db
			.selectFrom("birthdays as b")
			.leftJoin("reminder_logs as rl", (join) =>
				join
					.onRef("rl.birthday_id", "=", "b.id")
					.on("rl.year", "=", year)
					.on("rl.type", "=", type),
			)
			.select([
				"b.id as birthdayId",
				"b.user_id as userId",
				"b.name",
				"b.telegram_username as telegramUsername",
				"b.birth_day as birthDay",
				"b.birth_month as birthMonth",
				"b.birth_year as birthYear",
			])
			.where("b.user_id", "=", userId)
			.where(`b.${flag}` as "b.remind_on_day", "=", true)
			.where("b.birth_month", "=", targetMonth)
			.where("b.birth_day", "=", targetDay)
			.where("rl.id", "is", null) // not yet logged this year
			.execute();

		for (const row of rows) {
			results.push({
				birthdayId: row.birthdayId,
				userId: row.userId as unknown as string,
				name: row.name,
				telegramUsername: row.telegramUsername,
				birthDay: row.birthDay,
				birthMonth: row.birthMonth,
				birthYear: row.birthYear,
				reminderType: type,
			});
		}
	}

	return results;
}

export interface InsertBirthdayParams {
	userId: string;
	name: string;
	telegramUsername: string | null;
	description: string | null;
	birthDay: number;
	birthMonth: number;
	birthYear: number | null;
	remindOnDay: boolean;
	remind3DaysBefore: boolean;
	remind1WeekBefore: boolean;
}

/** Insert a new birthday entry and return the generated UUID. */
export async function insertBirthday(
	params: InsertBirthdayParams,
): Promise<string> {
	const row = await db
		.insertInto("birthdays")
		.values({
			user_id: params.userId,
			name: params.name,
			telegram_username: params.telegramUsername,
			description: params.description,
			birth_day: params.birthDay,
			birth_month: params.birthMonth,
			birth_year: params.birthYear,
			remind_on_day: params.remindOnDay,
			remind_3_days_before: params.remind3DaysBefore,
			remind_1_week_before: params.remind1WeekBefore,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return row.id;
}

export interface BirthdayEntry {
	id: string;
	name: string | null;
	telegramUsername: string | null;
	description: string | null;
	birthDay: number;
	birthMonth: number;
	birthYear: number | null;
	remindOnDay: boolean;
	remind3DaysBefore: boolean;
	remind1WeekBefore: boolean;
	daysUntil: number;
}

export interface UpdateBirthdayPatch {
	name?: string;
	telegramUsername?: string | null;
	description?: string | null;
	birthDay?: number;
	birthMonth?: number;
	birthYear?: number | null;
	remindOnDay?: boolean;
	remind3DaysBefore?: boolean;
	remind1WeekBefore?: boolean;
}

/**
 * Return upcoming birthdays for a user, sorted by next occurrence from today.
 * Uses a PostgreSQL expression to compute days-until so the sort wraps the year.
 */
export async function listUpcomingBirthdays(
	userId: string,
	offset: number,
	limit: number,
): Promise<BirthdayEntry[]> {
	const rows = await db
		.selectFrom("birthdays")
		.select([
			"id",
			"name",
			"telegram_username as telegramUsername",
			"description",
			"birth_day as birthDay",
			"birth_month as birthMonth",
			"birth_year as birthYear",
			"remind_on_day as remindOnDay",
			"remind_3_days_before as remind3DaysBefore",
			"remind_1_week_before as remind1WeekBefore",
			sql<number>`(
        make_date(
          CASE
            WHEN (birth_month > EXTRACT(MONTH FROM CURRENT_DATE)::int)
              OR (birth_month = EXTRACT(MONTH FROM CURRENT_DATE)::int
                  AND birth_day >= EXTRACT(DAY FROM CURRENT_DATE)::int)
            THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int + 1
          END,
          birth_month,
          birth_day
        ) - CURRENT_DATE
      )`.as("daysUntil"),
		])
		.where("user_id", "=", userId)
		.orderBy(sql`(
      make_date(
        CASE
          WHEN (birth_month > EXTRACT(MONTH FROM CURRENT_DATE)::int)
            OR (birth_month = EXTRACT(MONTH FROM CURRENT_DATE)::int
                AND birth_day >= EXTRACT(DAY FROM CURRENT_DATE)::int)
          THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
          ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int + 1
        END,
        birth_month,
        birth_day
      ) - CURRENT_DATE
    )`)
		.offset(offset)
		.limit(limit)
		.execute();

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		telegramUsername: r.telegramUsername,
		description: r.description,
		birthDay: r.birthDay,
		birthMonth: r.birthMonth,
		birthYear: r.birthYear,
		remindOnDay: r.remindOnDay as unknown as boolean,
		remind3DaysBefore: r.remind3DaysBefore as unknown as boolean,
		remind1WeekBefore: r.remind1WeekBefore as unknown as boolean,
		daysUntil: Number(r.daysUntil),
	}));
}

/** Return the total count of birthday entries for a user. */
export async function countBirthdays(userId: string): Promise<number> {
	const row = await db
		.selectFrom("birthdays")
		.select(db.fn.countAll<number>().as("count"))
		.where("user_id", "=", userId)
		.executeTakeFirstOrThrow();

	return Number(row.count);
}

/** Delete a birthday by ID, scoped to the owning user. Returns true if a row was deleted. */
export async function deleteBirthday(
	id: string,
	userId: string,
): Promise<boolean> {
	const result = await db
		.deleteFrom("birthdays")
		.where("id", "=", id)
		.where("user_id", "=", userId)
		.executeTakeFirst();

	return (result.numDeletedRows ?? BigInt(0)) > BigInt(0);
}

/** Update specific fields of a birthday, scoped to the owning user. */
export async function updateBirthday(
	id: string,
	userId: string,
	patch: UpdateBirthdayPatch,
): Promise<boolean> {
	const setValue: Record<string, unknown> = { updated_at: new Date() };

	if (patch.name !== undefined) setValue.name = patch.name;
	if (patch.telegramUsername !== undefined)
		setValue.telegram_username = patch.telegramUsername;
	if (patch.description !== undefined) setValue.description = patch.description;
	if (patch.birthDay !== undefined) setValue.birth_day = patch.birthDay;
	if (patch.birthMonth !== undefined) setValue.birth_month = patch.birthMonth;
	if (patch.birthYear !== undefined) setValue.birth_year = patch.birthYear;
	if (patch.remindOnDay !== undefined)
		setValue.remind_on_day = patch.remindOnDay;
	if (patch.remind3DaysBefore !== undefined)
		setValue.remind_3_days_before = patch.remind3DaysBefore;
	if (patch.remind1WeekBefore !== undefined)
		setValue.remind_1_week_before = patch.remind1WeekBefore;

	const result = await db
		.updateTable("birthdays")
		.set(setValue)
		.where("id", "=", id)
		.where("user_id", "=", userId)
		.executeTakeFirst();

	return (result.numUpdatedRows ?? BigInt(0)) > BigInt(0);
}

/** Insert a reminder log entry. Silently ignores duplicate inserts. */
export async function logReminder(
	birthdayId: string,
	year: number,
	type: ReminderType,
): Promise<void> {
	await db
		.insertInto("reminder_logs")
		.values({ birthday_id: birthdayId, year, type })
		.onConflict((oc) => oc.constraint("reminder_logs_unique").doNothing())
		.execute();
}
