import { sql } from "kysely";
import { beforeEach } from "vitest";
import { db } from "@/db";
import { seed as seedTestUser } from "@/db/seeds/1766326874035_add_test_user";

beforeEach(async () => {
	// Truncate everything
	const tables = await db.introspection.getTables();
	const tablesToTruncate = tables
		.map((t) => t.name)
		.filter((name) => !name.includes("kysely_migration"));

	if (tablesToTruncate.length > 0) {
		await sql`truncate table ${sql.join(tablesToTruncate.map(sql.table))} restart identity cascade`.execute(
			db,
		);
	}

	// Seed test user
	await seedTestUser(db);
});
