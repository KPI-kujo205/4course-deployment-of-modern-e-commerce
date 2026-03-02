import type { User } from "grammy/types";
import { z } from "zod";
import { updateUserTimezone, upsertUser } from "@/db/repos/user.repo";

const timezoneSchema = z.string().refine(
	(tz) => {
		try {
			Intl.DateTimeFormat(undefined, { timeZone: tz });
			return true;
		} catch {
			return false;
		}
	},
	{ message: "Invalid IANA timezone identifier" },
);

/**
 * Persist a Telegram user to the DB the first time they interact with the bot.
 * Subsequent calls for the same user are no-ops (INSERT ... ON CONFLICT DO NOTHING).
 */
export async function registerUser(from: User): Promise<void> {
	await upsertUser({
		id: String(from.id),
		username: from.username ?? null,
		firstName: from.first_name ?? null,
		tgUserJson: from as unknown as Record<string, unknown>,
	});
}

export type SetTimezoneResult =
	| { success: true }
	| { success: false; error: "invalid_timezone" | "db_error" };

/**
 * Validate an IANA timezone name using the built-in Intl API (no extra deps)
 * and persist it to the DB.
 *
 * Returns a typed result so the bot layer can give the user a clear error
 * without leaking DB internals.
 */
export async function setUserTimezone(
	userId: string,
	timezone: string,
): Promise<SetTimezoneResult> {
	if (!timezoneSchema.safeParse(timezone).success) {
		return { success: false, error: "invalid_timezone" };
	}

	try {
		await updateUserTimezone(userId, timezone);
		return { success: true };
	} catch {
		return { success: false, error: "db_error" };
	}
}

export async function applyTimezone(
	userId: string,
	tz: string,
	ctx: {
		reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
	},
): Promise<void> {
	const result = await setUserTimezone(userId, tz);

	if (!result.success) {
		if (result.error === "invalid_timezone") {
			await ctx.reply(
				`"${tz}" is not a valid timezone name.\n\n` +
					"Examples: Europe/Warsaw, America/New_York, Asia/Tokyo, UTC\n\n" +
					"Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones",
				{ reply_markup: { remove_keyboard: true } },
			);
		} else {
			await ctx.reply(
				"Something went wrong saving your timezone. Please try again later.",
				{
					reply_markup: { remove_keyboard: true },
				},
			);
		}
		return;
	}

	await ctx.reply(
		`Timezone set to ${tz}.\nBirthday reminders will now be sent at midnight in your local time.`,
		{ reply_markup: { remove_keyboard: true } },
	);
}
