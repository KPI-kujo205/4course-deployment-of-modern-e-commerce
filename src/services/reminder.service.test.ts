import { describe, expect, it, vi } from "vitest";
import { buildMessage, getLocalDate } from "./reminder.service";

vi.mock("grammy", () => ({
	Bot: vi.fn().mockImplementation(() => ({ api: {} })),
}));
vi.mock("@/env", () => ({ env: { TG_BOT_TOKEN: "test" } }));
vi.mock("@/db/repos/birthday.repo");
vi.mock("@/db/repos/user.repo");
vi.mock("@/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

describe("getLocalDate", () => {
	it("returns UTC midnight (time components are 0)", () => {
		const d = getLocalDate("UTC");
		expect(d.getUTCMinutes()).toBe(0);
		expect(d.getUTCSeconds()).toBe(0);
		expect(d.getUTCMilliseconds()).toBe(0);
	});

	it("returns the correct local date for UTC+0", () => {
		const d = getLocalDate("UTC");
		const now = new Date();
		// Compare year/month/day in UTC
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const [y, m, day] = formatter.format(now).split("-").map(Number);
		expect(d.getUTCFullYear()).toBe(y);
		expect(d.getUTCMonth() + 1).toBe(m);
		expect(d.getUTCDate()).toBe(day);
	});

	it("handles positive UTC offset (Europe/Warsaw)", () => {
		// Just check it doesn't throw and returns a valid date
		const d = getLocalDate("Europe/Warsaw");
		expect(d.getUTCFullYear()).toBeGreaterThan(2000);
	});

	it("handles negative UTC offset (America/New_York)", () => {
		const d = getLocalDate("America/New_York");
		expect(d.getUTCFullYear()).toBeGreaterThan(2000);
	});
});

// ─── buildMessage ─────────────────────────────────────────────────────────────

describe("buildMessage", () => {
	it("builds an on_day message with name and day/month", () => {
		const msg = buildMessage("Alice", 15, 6, null, "on_day");
		expect(msg).toContain("🎂");
		expect(msg).toContain("Alice");
		expect(msg).toContain("15 June");
	});

	it("builds a 3_days_before message", () => {
		const msg = buildMessage("Bob", 1, 1, null, "3_days_before");
		expect(msg).toContain("⏰");
		expect(msg).toContain("Bob");
		expect(msg).toContain("3 days");
	});

	it("builds a 1_week_before message", () => {
		const msg = buildMessage("Carol", 25, 12, null, "1_week_before");
		expect(msg).toContain("📅");
		expect(msg).toContain("Carol");
		expect(msg).toContain("1 week");
	});

	it("includes age string when birth year is provided", () => {
		const currentYear = new Date().getFullYear();
		const birthYear = currentYear - 30;
		const msg = buildMessage("Dave", 10, 3, birthYear, "on_day");
		expect(msg).toContain("turns 30");
	});

	it("omits age string when birth year is null", () => {
		const msg = buildMessage("Eve", 10, 3, null, "on_day");
		expect(msg).not.toContain("turns");
	});

	it("uses 'Someone' when name is null", () => {
		const msg = buildMessage(null, 5, 5, null, "on_day");
		expect(msg).toContain("Someone");
	});

	it("includes the correct month name", () => {
		expect(buildMessage("X", 1, 1, null, "on_day")).toContain("January");
		expect(buildMessage("X", 1, 7, null, "on_day")).toContain("July");
		expect(buildMessage("X", 1, 12, null, "on_day")).toContain("December");
	});
});
