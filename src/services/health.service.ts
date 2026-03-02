import {fetchSomeTable} from "@/db/repos/health.repo";

export interface HealthStatus {
	status: "ok" | "error";
	db: "ok" | "error";
}

export async function getHealthStatus(): Promise<HealthStatus> {
	try {
		await fetchSomeTable();

		return { status: "ok", db: "ok" };
	} catch {
		return { status: "error", db: "error" };
	}
}
