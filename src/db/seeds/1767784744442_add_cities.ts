import type { Kysely } from "kysely";

/** No-op seed — cities table was removed from this schema. */
// biome-ignore lint: seed file kept for import compatibility
export async function seed(_db: Kysely<unknown>): Promise<void> {
	// no cities table in current schema
}
