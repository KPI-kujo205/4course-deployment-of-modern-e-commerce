import {db} from "@/db";

export async function fetchSomeTable() {
	return db.selectFrom("user").select("id").limit(1).executeTakeFirstOrThrow();
}
