import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repos/health.repo");

import { fetchSomeTable } from "@/db/repos/health.repo";
import { getHealthStatus } from "./health.service";

const mockFetchSomeTable = vi.mocked(fetchSomeTable);

describe("getHealthStatus", () => {
	beforeEach(() => {
		mockFetchSomeTable.mockReset();
	});
	it("returns status ok and db ok when fetchSomeTable resolves", async () => {
		mockFetchSomeTable.mockResolvedValueOnce({ id: "1" });

		const result = await getHealthStatus();

		expect(result).toEqual({ status: "ok", db: "ok" });
	});

	it("returns status error and db error when fetchSomeTable rejects", async () => {
		mockFetchSomeTable.mockRejectedValueOnce(new Error("connection refused"));

		const result = await getHealthStatus();

		expect(result).toEqual({ status: "error", db: "error" });
	});

	it("calls fetchSomeTable once per invocation", async () => {
		mockFetchSomeTable.mockResolvedValueOnce({ id: "1" });

		await getHealthStatus();

		expect(mockFetchSomeTable).toHaveBeenCalledTimes(1);
	});
});
