import { Bot } from "grammy";
import { getDueBirthdays, logReminder } from "@/db/repos/birthday.repo";
import { getUsersAtLocalMidnight } from "@/db/repos/user.repo";
import { env } from "@/env";
import { logger } from "@/logger";

// Months as displayed names for Telegram messages
const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const bot = new Bot(env.TG_BOT_TOKEN);

/**
 * Main entry point called by the hourly cron job.
 *
 * Flow:
 *  1. Find all users whose local time is currently midnight (00:xx) in their timezone.
 *  2. For each such user, compute their local date from the stored IANA timezone.
 *  3. Query birthdays due for that local date (today, +3 days, +7 days).
 *  4. Send a Telegram message for each due birthday.
 *  5. Log the reminder so it is not sent again this year.
 */
export async function processReminders(): Promise<void> {
	const users = await getUsersAtLocalMidnight();

	if (users.length === 0) {
		return;
	}

	logger.info(
		{ count: users.length },
		"Processing reminders for users at local midnight",
	);

	for (const user of users) {
		const localDate = getLocalDate(user.timezone);
		const due = await getDueBirthdays(user.id as unknown as string, localDate);

		for (const birthday of due) {
			try {
				const message = buildMessage(
					birthday.name,
					birthday.birthDay,
					birthday.birthMonth,
					birthday.birthYear,
					birthday.reminderType,
				);
				await bot.api.sendMessage(user.id as unknown as string, message);
				await logReminder(
					birthday.birthdayId,
					localDate.getFullYear(),
					birthday.reminderType,
				);
				logger.info(
					{
						userId: user.id,
						birthdayId: birthday.birthdayId,
						type: birthday.reminderType,
					},
					"Reminder sent",
				);
			} catch (err) {
				logger.error(
					{ err, userId: user.id, birthdayId: birthday.birthdayId },
					"Failed to send reminder",
				);
			}
		}
	}
}

/**
 * Compute what the current date is in a given IANA timezone.
 * We format just the date parts and reconstruct a local midnight Date object
 * so downstream date arithmetic (getDate, getMonth, etc.) works correctly.
 */
function getLocalDate(timezone: string): Date {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	// en-CA locale produces "YYYY-MM-DD" format
	const parts = formatter.format(new Date()).split("-");
	const year = Number(parts[0]);
	const month = Number(parts[1]);
	const day = Number(parts[2]);
	// Construct as UTC midnight so there is no double-offset confusion downstream
	return new Date(Date.UTC(year, month - 1, day));
}

function buildMessage(
	name: string | null,
	day: number,
	month: number,
	year: number | null,
	type: "on_day" | "3_days_before" | "1_week_before",
): string {
	const displayName = name ?? "Someone";
	const monthName = MONTH_NAMES[month - 1];
	const ageStr = year ? ` (turns ${new Date().getFullYear() - year})` : "";

	switch (type) {
		case "on_day":
			return `🎂 Today is ${displayName}'s birthday! ${day} ${monthName}${ageStr}`;
		case "3_days_before":
			return `⏰ ${displayName}'s birthday is in 3 days — ${day} ${monthName}${ageStr}`;
		case "1_week_before":
			return `📅 ${displayName}'s birthday is in 1 week — ${day} ${monthName}${ageStr}`;
	}
}
