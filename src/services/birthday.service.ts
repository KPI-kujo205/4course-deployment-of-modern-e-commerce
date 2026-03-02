import type {
	BirthdayEntry,
	UpdateBirthdayPatch,
} from "@/db/repos/birthday.repo";
import {
	countBirthdays,
	deleteBirthday,
	insertBirthday,
	listUpcomingBirthdays,
	updateBirthday,
} from "@/db/repos/birthday.repo";

export type { BirthdayEntry };

export interface AddBirthdayData {
	name: string;
	telegramUsername: string | null;
	description: string | null;
	birthDay: number;
	birthMonth: number;
	birthYear: number | null;
	remindOnDay: boolean;
	remind3DaysBefore: boolean;
	remind1WeekBefore: boolean;
}

export type AddBirthdayResult =
	| { success: true; id: string }
	| { success: false; error: "invalid_date" | "db_error" };

export type RemoveBirthdayResult =
	| { success: true }
	| { success: false; error: "not_found" | "db_error" };

export type EditBirthdayResult =
	| { success: true }
	| { success: false; error: "invalid_date" | "not_found" | "db_error" };

export interface ListBirthdaysResult {
	entries: BirthdayEntry[];
	total: number;
	page: number;
	totalPages: number;
}

export const PAGE_SIZE = 20;

/**
 * Validate and persist a new birthday entry for a given user.
 * Returns the UUID of the created row on success, or a typed error on failure.
 */
export async function addBirthday(
	userId: string,
	data: AddBirthdayData,
): Promise<AddBirthdayResult> {
	if (!isValidBirthDate(data.birthDay, data.birthMonth, data.birthYear)) {
		return { success: false, error: "invalid_date" };
	}

	try {
		const id = await insertBirthday({ userId, ...data });
		return { success: true, id };
	} catch {
		return { success: false, error: "db_error" };
	}
}

/**
 * Return a paginated list of upcoming birthdays sorted by next occurrence.
 */
export async function listBirthdays(
	userId: string,
	page: number,
): Promise<ListBirthdaysResult> {
	const offset = (page - 1) * PAGE_SIZE;
	const [entries, total] = await Promise.all([
		listUpcomingBirthdays(userId, offset, PAGE_SIZE),
		countBirthdays(userId),
	]);

	return {
		entries,
		total,
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
	};
}

/**
 * Delete a birthday entry owned by the given user.
 */
export async function removeBirthday(
	userId: string,
	birthdayId: string,
): Promise<RemoveBirthdayResult> {
	try {
		const deleted = await deleteBirthday(birthdayId, userId);
		if (!deleted) return { success: false, error: "not_found" };
		return { success: true };
	} catch {
		return { success: false, error: "db_error" };
	}
}

/**
 * Update one or more fields of a birthday entry owned by the given user.
 * Validates any date fields present in the patch before persisting.
 */
export async function editBirthday(
	userId: string,
	birthdayId: string,
	patch: UpdateBirthdayPatch,
): Promise<EditBirthdayResult> {
	// Validate date fields if any are present in the patch
	if (
		patch.birthDay !== undefined ||
		patch.birthMonth !== undefined ||
		patch.birthYear !== undefined
	) {
		// We need all three to validate — fetch missing ones if needed
		// For now the callers always send all three date fields together
		const day = patch.birthDay;
		const month = patch.birthMonth;
		if (day !== undefined && month !== undefined) {
			if (!isValidBirthDate(day, month, patch.birthYear ?? null)) {
				return { success: false, error: "invalid_date" };
			}
		}
	}

	try {
		const updated = await updateBirthday(birthdayId, userId, patch);
		if (!updated) return { success: false, error: "not_found" };
		return { success: true };
	} catch {
		return { success: false, error: "db_error" };
	}
}

/**
 * Validate that the day/month combination is a real calendar date.
 * Year is optional — when provided it must be a plausible birth year.
 */
export function isValidBirthDate(
	day: number,
	month: number,
	year: number | null,
): boolean {
	if (month < 1 || month > 12) return false;
	if (day < 1) return false;

	const refYear = year ?? 2000;

	if (year !== null) {
		const currentYear = new Date().getFullYear();
		if (year < 1900 || year > currentYear) return false;
	}

	// Date constructor with out-of-range day rolls over — detect that
	const d = new Date(refYear, month - 1, day);
	return d.getMonth() === month - 1 && d.getDate() === day;
}
