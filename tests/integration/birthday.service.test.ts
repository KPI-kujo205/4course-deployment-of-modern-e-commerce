import { describe, expect, it } from "vitest";
import {
	addBirthday,
	editBirthday,
	listBirthdays,
	removeBirthday,
} from "@/services/birthday.service";

const USER_ID = "1"; // seeded by setup.ts
const OTHER_USER_ID = "999";

const BASE_DATA = {
	name: "Alice",
	birthDay: 15,
	birthMonth: 6,
	birthYear: 1990,
	telegramUsername: null,
	description: null,
	remindOnDay: true,
	remind3DaysBefore: false,
	remind1WeekBefore: false,
} as const;

// ─── addBirthday ──────────────────────────────────────────────────────────────

describe("addBirthday", () => {
	it("returns success with a UUID on valid input", async () => {
		const result = await addBirthday(USER_ID, BASE_DATA);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("returns invalid_date for Feb 30", async () => {
		const result = await addBirthday(USER_ID, {
			...BASE_DATA,
			birthDay: 30,
			birthMonth: 2,
		});
		expect(result).toEqual({ success: false, error: "invalid_date" });
	});

	it("returns invalid_date for month 13", async () => {
		const result = await addBirthday(USER_ID, {
			...BASE_DATA,
			birthDay: 1,
			birthMonth: 13,
		});
		expect(result).toEqual({ success: false, error: "invalid_date" });
	});

	it("accepts entry without birth year", async () => {
		const result = await addBirthday(USER_ID, {
			...BASE_DATA,
			birthYear: null,
		});
		expect(result.success).toBe(true);
	});

	it("accepts entry without telegram or description", async () => {
		const result = await addBirthday(USER_ID, {
			...BASE_DATA,
			telegramUsername: null,
			description: null,
		});
		expect(result.success).toBe(true);
	});
});

// ─── listBirthdays ────────────────────────────────────────────────────────────

describe("listBirthdays", () => {
	it("returns zero entries for a user with no birthdays", async () => {
		const result = await listBirthdays(OTHER_USER_ID, 1);
		expect(result.total).toBe(0);
		expect(result.entries).toHaveLength(0);
		expect(result.totalPages).toBe(1);
	});

	it("returns added entries", async () => {
		await addBirthday(USER_ID, BASE_DATA);
		const result = await listBirthdays(USER_ID, 1);
		expect(result.total).toBe(1);
		expect(result.entries[0]?.name).toBe("Alice");
	});

	it("returns correct pagination metadata", async () => {
		await addBirthday(USER_ID, BASE_DATA);
		await addBirthday(USER_ID, { ...BASE_DATA, name: "Bob" });
		const result = await listBirthdays(USER_ID, 1);
		expect(result.total).toBe(2);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(1);
	});

	it("entries are sorted by daysUntil ascending", async () => {
		// Add two entries: one in January and one in December
		// Depending on today, one will be sooner than the other
		await addBirthday(USER_ID, { ...BASE_DATA, birthDay: 1, birthMonth: 1 });
		await addBirthday(USER_ID, { ...BASE_DATA, birthDay: 31, birthMonth: 12 });
		const result = await listBirthdays(USER_ID, 1);
		expect(result.entries.length).toBe(2);
		const [first, second] = result.entries;
		expect(first!.daysUntil).toBeLessThanOrEqual(second!.daysUntil);
	});

	it("daysUntil is non-negative for all entries", async () => {
		await addBirthday(USER_ID, BASE_DATA);
		const result = await listBirthdays(USER_ID, 1);
		for (const entry of result.entries) {
			expect(entry.daysUntil).toBeGreaterThanOrEqual(0);
		}
	});
});

// ─── removeBirthday ───────────────────────────────────────────────────────────

describe("removeBirthday", () => {
	it("removes an existing birthday", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await removeBirthday(USER_ID, added.id);
		expect(result.success).toBe(true);

		const list = await listBirthdays(USER_ID, 1);
		expect(list.total).toBe(0);
	});

	it("returns not_found for a non-existent ID", async () => {
		const result = await removeBirthday(
			USER_ID,
			"00000000-0000-0000-0000-000000000000",
		);
		expect(result).toEqual({ success: false, error: "not_found" });
	});

	it("returns not_found when user doesn't own the birthday", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await removeBirthday(OTHER_USER_ID, added.id);
		expect(result).toEqual({ success: false, error: "not_found" });

		// Entry should still exist for the real owner
		const list = await listBirthdays(USER_ID, 1);
		expect(list.total).toBe(1);
	});
});

// ─── editBirthday ─────────────────────────────────────────────────────────────

describe("editBirthday", () => {
	it("updates the name", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await editBirthday(USER_ID, added.id, { name: "Alicia" });
		expect(result.success).toBe(true);

		const list = await listBirthdays(USER_ID, 1);
		expect(list.entries[0]?.name).toBe("Alicia");
	});

	it("updates the date", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await editBirthday(USER_ID, added.id, {
			birthDay: 1,
			birthMonth: 1,
			birthYear: 2000,
		});
		expect(result.success).toBe(true);

		const list = await listBirthdays(USER_ID, 1);
		expect(list.entries[0]?.birthDay).toBe(1);
		expect(list.entries[0]?.birthMonth).toBe(1);
		expect(list.entries[0]?.birthYear).toBe(2000);
	});

	it("returns invalid_date for Feb 30 in patch", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await editBirthday(USER_ID, added.id, {
			birthDay: 30,
			birthMonth: 2,
			birthYear: null,
		});
		expect(result).toEqual({ success: false, error: "invalid_date" });
	});

	it("returns not_found for wrong owner", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		const result = await editBirthday(OTHER_USER_ID, added.id, {
			name: "Hacker",
		});
		expect(result).toEqual({ success: false, error: "not_found" });
	});

	it("updates reminder flags", async () => {
		const added = await addBirthday(USER_ID, BASE_DATA);
		if (!added.success) throw new Error("setup failed");

		await editBirthday(USER_ID, added.id, {
			remindOnDay: false,
			remind3DaysBefore: true,
			remind1WeekBefore: true,
		});

		const list = await listBirthdays(USER_ID, 1);
		expect(list.entries[0]?.remindOnDay).toBe(false);
		expect(list.entries[0]?.remind3DaysBefore).toBe(true);
		expect(list.entries[0]?.remind1WeekBefore).toBe(true);
	});

	it("clears optional fields to null", async () => {
		const added = await addBirthday(USER_ID, {
			...BASE_DATA,
			telegramUsername: "@alice",
			description: "Best friend",
		});
		if (!added.success) throw new Error("setup failed");

		await editBirthday(USER_ID, added.id, {
			telegramUsername: null,
			description: null,
		});

		const list = await listBirthdays(USER_ID, 1);
		expect(list.entries[0]?.telegramUsername).toBeNull();
		expect(list.entries[0]?.description).toBeNull();
	});
});
