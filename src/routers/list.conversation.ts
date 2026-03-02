import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { BirthdayEntry } from "@/services/birthday.service";
import {
	editBirthday,
	isValidBirthDate,
	listBirthdays,
	removeBirthday,
} from "@/services/birthday.service";
import {
	formatDetailCard,
	formatEntryLine,
	parseBirthDate,
} from "@/utils/birthday.helpers";

type BotContext = ConversationFlavor<Context>;
type BotConversation = Conversation<BotContext, BotContext>;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the update is a bot command (e.g. /add, /list). */
function isCommand(ctx: BotContext): boolean {
	return (
		ctx.message?.entities?.some(
			(e) => e.type === "bot_command" && e.offset === 0,
		) ?? false
	);
}

/**
 * Wait for a callback query update. If the user sends a command instead,
 * halt the conversation with `next: true` so grammY routes the command
 * through the normal handler chain (no double-send needed).
 */
async function waitForCallback(
	conversation: BotConversation,
): Promise<BotContext> {
	const next = await conversation.wait();
	if (isCommand(next)) await conversation.halt({ next: true });
	if (!next.callbackQuery?.data) return waitForCallback(conversation);
	return next;
}

/**
 * Wait for a plain text message. If the user sends a command instead,
 * halt the conversation with `next: true`.
 */
async function waitForText(conversation: BotConversation): Promise<BotContext> {
	const next = await conversation.wait();
	if (isCommand(next)) await conversation.halt({ next: true });
	if (!next.message?.text) return waitForText(conversation);
	return next;
}

// ─── keyboard builders ────────────────────────────────────────────────────────

function buildListKeyboard(
	entries: BirthdayEntry[],
	page: number,
	totalPages: number,
): InlineKeyboard {
	const kb = new InlineKeyboard();

	for (const entry of entries) {
		kb.text(formatEntryLine(entry), `detail:${entry.id}`).row();
	}

	// Pagination row
	const prevText = page > 1 ? "← Prev" : "·";
	const nextText = page < totalPages ? "Next →" : "·";
	kb.text(prevText, page > 1 ? `page:${page - 1}` : "noop")
		.text(`${page} / ${totalPages}`, "noop")
		.text(nextText, page < totalPages ? `page:${page + 1}` : "noop");

	return kb;
}

function buildDetailKeyboard(id: string): InlineKeyboard {
	return new InlineKeyboard()
		.text("Edit", `edit:${id}`)
		.text("Delete", `delete:${id}`)
		.row()
		.text("← Back to list", "back");
}

function buildEditFieldKeyboard(id: string): InlineKeyboard {
	return new InlineKeyboard()
		.text("Name", `field:name:${id}`)
		.text("Birthday date", `field:date:${id}`)
		.row()
		.text("Telegram", `field:telegram:${id}`)
		.text("Note", `field:note:${id}`)
		.row()
		.text("Reminders", `field:reminders:${id}`)
		.row()
		.text("← Back", `detail:${id}`);
}

function buildReminderToggleKeyboard(
	on: boolean,
	three: boolean,
	week: boolean,
	id: string,
): InlineKeyboard {
	return new InlineKeyboard()
		.text(`${on ? "✅" : "⬜"} On the day`, `rtoggle:on:${id}`)
		.text(`${three ? "✅" : "⬜"} 3 days before`, `rtoggle:3d:${id}`)
		.row()
		.text(`${week ? "✅" : "⬜"} 1 week before`, `rtoggle:1w:${id}`)
		.row()
		.text("Save reminders", `rsave:${id}`);
}

function buildDeleteConfirmKeyboard(id: string): InlineKeyboard {
	return new InlineKeyboard()
		.text("Yes, delete", `confirmdelete:${id}`)
		.text("Cancel", `detail:${id}`);
}

// ─── main conversation ────────────────────────────────────────────────────────

/**
 * /list conversation.
 *
 * Shows a paginated inline keyboard of upcoming birthdays.
 * Tapping an entry opens a detail card with Edit / Delete / Back actions —
 * all handled inline within the same conversation.
 *
 * If the user sends any bot command while the conversation is active,
 * `conversation.halt({ next: true })` is called so grammY immediately
 * routes that command through the normal handler chain (single send, no
 * double-command quirk).
 */
export async function listConversation(
	conversation: BotConversation,
	ctx: BotContext,
): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) return;

	let page = 1;

	// Fetch and render the first page
	const initialData = await conversation.external(() =>
		listBirthdays(String(userId), page),
	);

	if (initialData.total === 0) {
		await ctx.reply("You have no birthdays saved yet. Use /add to add one!");
		return;
	}

	const listMsg = await ctx.reply(
		`Your upcoming birthdays (${initialData.total} total):`,
		{
			reply_markup: buildListKeyboard(
				initialData.entries,
				page,
				initialData.totalPages,
			),
		},
	);

	// ── event loop ──────────────────────────────────────────────────────────────
	while (true) {
		// halt({ next: true }) is called inside waitForCallback if a command arrives
		const cbCtx = await waitForCallback(conversation);

		const data = cbCtx.callbackQuery?.data ?? "";
		await cbCtx.answerCallbackQuery();

		// ── noop ─────────────────────────────────────────────────────────────────
		if (data === "noop") continue;

		// ── pagination ───────────────────────────────────────────────────────────
		if (data.startsWith("page:")) {
			const parsed = Number(data.slice(5));
			if (Number.isNaN(parsed)) continue;
			page = parsed;
			const pageData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);
			await cbCtx.api.editMessageReplyMarkup(
				listMsg.chat.id,
				listMsg.message_id,
				{
					reply_markup: buildListKeyboard(
						pageData.entries,
						page,
						pageData.totalPages,
					),
				},
			);
			continue;
		}

		// ── detail view ──────────────────────────────────────────────────────────
		if (data.startsWith("detail:")) {
			const id = data.slice(7);

			const pageData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);
			const entry = pageData.entries.find((e) => e.id === id);
			if (!entry) continue;

			await cbCtx.api.editMessageText(
				listMsg.chat.id,
				listMsg.message_id,
				formatDetailCard(entry),
				{ reply_markup: buildDetailKeyboard(id) },
			);
			continue;
		}

		// ── back to list ─────────────────────────────────────────────────────────
		if (data === "back") {
			const pageData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);
			await cbCtx.api.editMessageText(
				listMsg.chat.id,
				listMsg.message_id,
				`Your upcoming birthdays (${pageData.total} total):`,
				{
					reply_markup: buildListKeyboard(
						pageData.entries,
						page,
						pageData.totalPages,
					),
				},
			);
			continue;
		}

		// ── delete flow ──────────────────────────────────────────────────────────
		if (data.startsWith("delete:")) {
			const id = data.slice(7);
			const pageData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);
			const entry = pageData.entries.find((e) => e.id === id);
			if (!entry) continue;

			await cbCtx.api.editMessageText(
				listMsg.chat.id,
				listMsg.message_id,
				`Delete "${entry.name ?? "this person"}"? This cannot be undone.`,
				{ reply_markup: buildDeleteConfirmKeyboard(id) },
			);
			continue;
		}

		if (data.startsWith("confirmdelete:")) {
			const id = data.slice(14);
			await conversation.external(() => removeBirthday(String(userId), id));

			const pageData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);

			if (pageData.total === 0) {
				await cbCtx.api.editMessageText(
					listMsg.chat.id,
					listMsg.message_id,
					"Deleted. You have no more birthdays saved.",
				);
				return;
			}

			// If we deleted the last item on this page, go back one page
			if (page > pageData.totalPages) page = pageData.totalPages;

			const freshData = await conversation.external(() =>
				listBirthdays(String(userId), page),
			);

			await cbCtx.api.editMessageText(
				listMsg.chat.id,
				listMsg.message_id,
				`Deleted. Your upcoming birthdays (${freshData.total} total):`,
				{
					reply_markup: buildListKeyboard(
						freshData.entries,
						page,
						freshData.totalPages,
					),
				},
			);
			continue;
		}

		// ── edit flow ────────────────────────────────────────────────────────────
		if (data.startsWith("edit:")) {
			const id = data.slice(5);
			await cbCtx.api.editMessageReplyMarkup(
				listMsg.chat.id,
				listMsg.message_id,
				{ reply_markup: buildEditFieldKeyboard(id) },
			);
			continue;
		}

		// Field chosen
		if (data.startsWith("field:")) {
			const parts = data.split(":");
			// format: field:<fieldName>:<id>  — id is a UUID (hyphens, no colons)
			const field = parts[1];
			const id = parts.slice(2).join(":");

			if (!field) continue;

			await handleEditField(
				conversation,
				cbCtx,
				listMsg,
				field,
				id,
				String(userId),
				page,
			);
		}
	}
}

// ─── edit-field handler ───────────────────────────────────────────────────────

async function handleEditField(
	conversation: BotConversation,
	cbCtx: BotContext,
	listMsg: { chat: { id: number }; message_id: number },
	field: string,
	id: string,
	userId: string,
	page: number,
): Promise<void> {
	// Fetch current entry for pre-fill display
	const pageData = await conversation.external(() =>
		listBirthdays(userId, page),
	);
	const entry = pageData.entries.find((e) => e.id === id);
	if (!entry) return;

	if (field === "name") {
		await cbCtx.reply(
			`Current name: ${entry.name ?? "—"}\n\nEnter the new name (or /cancel):`,
		);
		while (true) {
			// halt({ next: true }) fires automatically inside waitForText on command
			const nameCtx = await waitForText(conversation);
			const val = nameCtx.message?.text?.trim() ?? "";
			if (!val || val === "/cancel") {
				await nameCtx.reply("Edit cancelled.");
				break;
			}
			const result = await conversation.external(() =>
				editBirthday(userId, id, { name: val }),
			);
			if (result.success) {
				await nameCtx.reply(`Name updated to: ${val}`);
			} else {
				await nameCtx.reply("Something went wrong. Please try again.");
			}
			break;
		}
	} else if (field === "date") {
		await cbCtx.reply(
			`Current birthday: ${entry.birthDay}/${entry.birthMonth}${entry.birthYear ? `/${entry.birthYear}` : ""}\n\nEnter the new date (DD/MM or DD/MM/YYYY), or /cancel:`,
		);
		while (true) {
			const dateCtx = await waitForText(conversation);
			const raw = dateCtx.message?.text?.trim() ?? "";
			if (raw === "/cancel") {
				await dateCtx.reply("Edit cancelled.");
				break;
			}
			const parsed = parseBirthDate(raw);
			if (!parsed || !isValidBirthDate(parsed.day, parsed.month, parsed.year)) {
				await dateCtx.reply(
					"Couldn't parse that date. Use DD/MM or DD/MM/YYYY (e.g. 25/06 or 25/06/1990):",
				);
				continue;
			}
			const result = await conversation.external(() =>
				editBirthday(userId, id, {
					birthDay: parsed.day,
					birthMonth: parsed.month,
					birthYear: parsed.year,
				}),
			);
			if (result.success) {
				await dateCtx.reply(
					`Birthday updated to: ${parsed.day}/${parsed.month}${parsed.year ? `/${parsed.year}` : ""}`,
				);
			} else {
				await dateCtx.reply("Something went wrong. Please try again.");
			}
			break;
		}
	} else if (field === "telegram") {
		await cbCtx.reply(
			`Current Telegram: ${entry.telegramUsername ?? "—"}\n\nEnter the new username (e.g. @johndoe), /skip to clear, or /cancel:`,
		);
		const tgCtx = await waitForText(conversation);
		const raw = tgCtx.message?.text?.trim() ?? "";
		if (raw === "/cancel") {
			await tgCtx.reply("Edit cancelled.");
		} else {
			const val =
				raw === "/skip" || raw === "skip"
					? null
					: raw.startsWith("@")
						? raw
						: `@${raw}`;
			const result = await conversation.external(() =>
				editBirthday(userId, id, { telegramUsername: val }),
			);
			if (result.success) {
				await tgCtx.reply(
					val ? `Telegram updated to: ${val}` : "Telegram username cleared.",
				);
			} else {
				await tgCtx.reply("Something went wrong. Please try again.");
			}
		}
	} else if (field === "note") {
		await cbCtx.reply(
			`Current note: ${entry.description ?? "—"}\n\nEnter a new note, /skip to clear, or /cancel:`,
		);
		const noteCtx = await waitForText(conversation);
		const raw = noteCtx.message?.text?.trim() ?? "";
		if (raw === "/cancel") {
			await noteCtx.reply("Edit cancelled.");
		} else {
			const val = raw === "/skip" || raw === "skip" ? null : raw;
			const result = await conversation.external(() =>
				editBirthday(userId, id, { description: val }),
			);
			if (result.success) {
				await noteCtx.reply(val ? `Note updated to: ${val}` : "Note cleared.");
			} else {
				await noteCtx.reply("Something went wrong. Please try again.");
			}
		}
	} else if (field === "reminders") {
		let on = entry.remindOnDay;
		let three = entry.remind3DaysBefore;
		let week = entry.remind1WeekBefore;

		const reminderMsg = await cbCtx.reply(
			"Toggle reminder windows, then press Save:",
			{ reply_markup: buildReminderToggleKeyboard(on, three, week, id) },
		);

		while (true) {
			const rCbCtx = await waitForCallback(conversation);
			const rData = rCbCtx.callbackQuery?.data ?? "";
			await rCbCtx.answerCallbackQuery();

			if (rData === `rtoggle:on:${id}`) {
				on = !on;
			} else if (rData === `rtoggle:3d:${id}`) {
				three = !three;
			} else if (rData === `rtoggle:1w:${id}`) {
				week = !week;
			} else if (rData === `rsave:${id}`) {
				await conversation.external(() =>
					editBirthday(userId, id, {
						remindOnDay: on,
						remind3DaysBefore: three,
						remind1WeekBefore: week,
					}),
				);
				await rCbCtx.api.editMessageReplyMarkup(
					reminderMsg.chat.id,
					reminderMsg.message_id,
					{ reply_markup: undefined },
				);
				await rCbCtx.reply("Reminders updated.");
				break;
			}

			await rCbCtx.api.editMessageReplyMarkup(
				reminderMsg.chat.id,
				reminderMsg.message_id,
				{ reply_markup: buildReminderToggleKeyboard(on, three, week, id) },
			);
		}
	}
}
