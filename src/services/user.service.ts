import type { User } from "grammy/types";
import { updateUserTimezone, upsertUser } from "@/db/repos/user.repo";

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
	if (!isValidIanaTimezone(timezone)) {
		return { success: false, error: "invalid_timezone" };
	}

	try {
		await updateUserTimezone(userId, timezone);
		return { success: true };
	} catch {
		return { success: false, error: "db_error" };
	}
}

/**
 * Validate an IANA timezone identifier using the Intl.DateTimeFormat API.
 * Node 20 supports Intl.supportedValuesOf("timeZone") for an exact check.
 */
function isValidIanaTimezone(tz: string): boolean {
	try {
		// This throws a RangeError for unknown timezone identifiers.
		Intl.DateTimeFormat(undefined, { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}
