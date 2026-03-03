import { db } from "@/db";

export async function fetchSomeTable() {
	return db.selectFrom("users").select("id").limit(1).executeTakeFirst();
}
