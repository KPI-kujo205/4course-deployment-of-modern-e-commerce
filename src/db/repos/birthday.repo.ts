import {db} from "@/db";

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
