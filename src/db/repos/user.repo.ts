import { sql } from "kysely";
import { db } from "@/db";

export interface UpsertUserParams {
	id: string;
	username: string | null;
	firstName: string | null;
	tgUserJson: Record<string, unknown>;
}

/**
 * Insert a new user row. If the user already exists (same Telegram ID),
 * the insert is silently ignored — safe to call on every /start.
 */
export async function upsertUser(params: UpsertUserParams): Promise<void> {
	await db
		.insertInto("users")
		.values({
			id: params.id,
			username: params.username,
			first_name: params.firstName,
			tg_user_json: JSON.stringify(params.tgUserJson),
		})
		.onConflict((oc) => oc.column("id").doNothing())
		.execute();
}

/** Update the IANA timezone for a given user. */
export async function updateUserTimezone(
	userId: string,
	timezone: string,
): Promise<void> {
	await db
		.updateTable("users")
		.set({ timezone })
		.where("id", "=", userId)
		.execute();
}

/**
 * Return all users whose local clock is currently in the midnight window (00:xx).
 *
 * PostgreSQL evaluates `now() AT TIME ZONE timezone` using each row's stored
 * IANA timezone string, so this runs entirely inside the DB — no per-row
 * round-trips from Node.
 */
export async function getUsersAtLocalMidnight() {
	return db
		.selectFrom("users")
		.select(["id", "timezone"])
		.where(sql<boolean>`EXTRACT(HOUR FROM now() AT TIME ZONE timezone) = 0`)
		.execute();
}

/** Return true if a user row exists for the given Telegram user ID. */
export async function userExists(userId: string): Promise<boolean> {
	const row = await db
		.selectFrom("users")
		.select("id")
		.where("id", "=", userId)
		.executeTakeFirst();

	return row !== undefined;
}
