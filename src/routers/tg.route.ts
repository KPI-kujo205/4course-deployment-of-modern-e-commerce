import {find} from "geo-tz";
import {Bot, webhookCallback} from "grammy";
import {Hono} from "hono";
import {env} from "@/env";
import {logger} from "@/logger";
import {requireRegistered} from "@/middlewares/requireRegistered.middleware";
import {applyTimezone, registerUser} from "@/services/user.service";

const endpoint = `${env.BASE_URL}/bot/webhook`;

export const bot = new Bot(env.TG_BOT_TOKEN);

const tgRoute = new Hono();

if (env.NODE_ENV === "production") {
	tgRoute.use("/webhook", webhookCallback(bot, "hono"));
	bot.api.setWebhook(endpoint);
} else {
	logger.info("Running in development mode, using long polling");
	bot.start();
}

const COMMANDS_TEXT =
	"Here's what I can do:\n\n" +
	"/start — show this message\n" +
	"/settimezone — set your timezone (share location or type a name like Europe/Warsaw)";

/**
 * /start
 *
 * Registers the user in the DB on first interaction (subsequent calls are
 * no-ops). Always replies with the full command list so the user knows what
 * the bot can do.
 */
bot.command("start", async (ctx) => {
	const from = ctx.from;
	if (!from) {
		await ctx.reply("Could not identify your user. Please try again.");
		return;
	}

	try {
		await registerUser(from);
	} catch (err) {
		logger.error({ err, userId: from.id }, "Failed to register user on /start");
	}

	const name = from.first_name ?? from.username ?? "there";
	await ctx.reply(
		`Welcome to Birthday Reminder Bot, ${name}!\n\n${COMMANDS_TEXT}`,
	);
});

/**
 * /settimezone [IANA timezone]
 *
 * Without argument — sends a "Share my location" button so the bot can
 * detect the timezone automatically from GPS coordinates.
 *
 * With argument — sets the timezone directly by IANA name:
 *   /settimezone Europe/Warsaw
 *   /settimezone America/New_York
 *   /settimezone Asia/Tokyo
 *
 * Timezone changes take effect on the next hourly cron tick.
 */
bot.command("settimezone", requireRegistered, async (ctx) => {
	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply("Could not identify your user ID. Please try again.");
		return;
	}

	const tz = ctx.match?.trim();

	// No argument — prompt the user to share their location
	if (!tz) {
		await ctx.reply(
			"Share your location and I will detect your timezone automatically.\n\n" +
				"On desktop? Type your timezone directly instead:\n" +
				"/settimezone Europe/Warsaw",
			{
				reply_markup: {
					keyboard: [[{ text: "Share my location", request_location: true }]],
					resize_keyboard: true,
					one_time_keyboard: true,
				},
			},
		);
		return;
	}

	// Argument provided — set timezone directly by IANA name
	await applyTimezone(String(userId), tz, ctx);
});

/**
 * Location message handler — fires when the user taps "Share my location".
 *
 * Resolves the IANA timezone from GPS coordinates using geo-tz (offline,
 * no API key required) and saves it exactly like the text command does.
 */
bot.on("message:location", async (ctx) => {
	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply("Could not identify your user ID. Please try again.");
		return;
	}

	const { latitude, longitude } = ctx.message.location;
	logger.info(
		{ userId, latitude, longitude },
		"Received location for timezone detection",
	);

	const candidates = find(latitude, longitude);
	const tz = candidates[0];

	if (!tz) {
		await ctx.reply(
			"Could not detect a timezone for your location.\n" +
				"Please set it manually: /settimezone Europe/Warsaw",
			{ reply_markup: { remove_keyboard: true } },
		);
		return;
	}

	await applyTimezone(String(userId), tz, ctx);
});

bot.on("message", async (ctx) => {
	logger.info({ userId: ctx.from?.id }, "Received message");
	await ctx.reply(
		"Hello! I am your birthday reminder bot.\n\n" +
			"Use /settimezone to set your timezone — " +
			"you can share your location or type a timezone name directly (like /settimezone Europe/Warsaw).\n\n",
	);
});

export { tgRoute };
