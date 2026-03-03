import { fetchSomeTable } from "@/db/repos/health.repo";
import { logger } from "@/logger";

export interface HealthStatus {
	status: "ok" | "error";
	db: "ok" | "error";
}

export async function getHealthStatus(): Promise<HealthStatus> {
	try {
		await fetchSomeTable();

		return { status: "ok", db: "ok" };
	} catch (err) {
		logger.error(err);
		return { status: "error", db: "error" };
	}
}
