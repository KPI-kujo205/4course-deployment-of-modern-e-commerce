import type { Kysely } from "kysely";

/** Seed a test user for integration tests. */
export async function seed(db: Kysely<any>): Promise<void> {
	await db
		.insertInto("users")
		.values({
			id: "1",
			username: "testuser",
			first_name: "Test",
			tg_user_json: JSON.stringify({
				id: 1,
				username: "testuser",
				first_name: "Test",
			}),
			timezone: "UTC",
		})
		.onConflict((oc) => oc.column("id").doNothing())
		.execute();
}
