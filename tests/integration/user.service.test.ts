import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { userExists } from "@/db/repos/user.repo";
import { registerUser, setUserTimezone } from "@/services/user.service";

const USER_ID = "1"; // seeded by setup.ts

describe("userExists", () => {
	it("returns true for the seeded test user", async () => {
		expect(await userExists(USER_ID)).toBe(true);
	});

	it("returns false for a non-existent user", async () => {
		expect(await userExists("99999")).toBe(false);
	});
});

describe("registerUser", () => {
	it("inserts a new user", async () => {
		await registerUser({
			id: 42,
			first_name: "New",
			username: "newuser",
			is_bot: false,
			language_code: "en",
		});
		expect(await userExists("42")).toBe(true);
	});

	it("is idempotent — calling twice does not throw", async () => {
		const user = {
			id: 43,
			first_name: "Dupe",
			username: "dupeuser",
			is_bot: false,
			language_code: "en",
		};
		await registerUser(user);
		// Second call must not throw (ON CONFLICT DO NOTHING)
		await expect(registerUser(user)).resolves.not.toThrow();
		expect(await userExists("43")).toBe(true);
	});

	it("handles null username gracefully", async () => {
		await registerUser({
			id: 44,
			first_name: "NoHandle",
			username: undefined,
			is_bot: false,
			language_code: "en",
		});
		expect(await userExists("44")).toBe(true);
	});
});

// ─── setUserTimezone ──────────────────────────────────────────────────────────

describe("setUserTimezone", () => {
	it("sets a valid IANA timezone", async () => {
		const result = await setUserTimezone(USER_ID, "Europe/Warsaw");
		expect(result.success).toBe(true);

		const row = await db
			.selectFrom("users")
			.select("timezone")
			.where("id", "=", USER_ID)
			.executeTakeFirstOrThrow();
		expect(row.timezone).toBe("Europe/Warsaw");
	});

	it("sets UTC timezone", async () => {
		const result = await setUserTimezone(USER_ID, "UTC");
		expect(result.success).toBe(true);
	});

	it("rejects an invalid timezone name", async () => {
		const result = await setUserTimezone(USER_ID, "Not/ATimezone");
		expect(result).toEqual({ success: false, error: "invalid_timezone" });
	});

	it("rejects an empty string as timezone", async () => {
		const result = await setUserTimezone(USER_ID, "");
		expect(result).toEqual({ success: false, error: "invalid_timezone" });
	});

	it("rejects a random string", async () => {
		const result = await setUserTimezone(USER_ID, "banana");
		expect(result).toEqual({ success: false, error: "invalid_timezone" });
	});

	it("accepts various valid IANA timezones", async () => {
		const validZones = [
			"America/New_York",
			"Asia/Tokyo",
			"Europe/London",
			"Pacific/Auckland",
		];
		for (const tz of validZones) {
			const result = await setUserTimezone(USER_ID, tz);
			expect(result.success).toBe(true);
		}
	});
});
