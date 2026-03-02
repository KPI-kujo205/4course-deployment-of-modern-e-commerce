import { sql } from "kysely";
import { afterAll, beforeEach } from "vitest";
import { db } from "@/db";
import { seed as seedTestUser } from "@/db/seeds/1766326874035_add_test_user";
import { seed as seedCities } from "@/db/seeds/1767784744442_add_cities";

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

  // Seed cities
  // @ts-ignore
  await seedCities(db);

  // Seed test user
  // @ts-ignore
  await seedTestUser(db);
});

afterAll(async () => {
  await db.destroy();
});
