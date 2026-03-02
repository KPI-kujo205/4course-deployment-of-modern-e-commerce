import {Bot, webhookCallback} from "grammy";
import {Hono} from "hono";
import {env} from "@/env";
import {logger} from "@/logger";

const endpoint = `${env.BASE_URL}/bot/webhook`;

const bot = new Bot(env.TG_BOT_TOKEN);

const tgRoute = new Hono();

if (env.NODE_ENV === "production") {
	tgRoute.use("/webhook", webhookCallback(bot, "hono"));
	bot.api.setWebhook(endpoint);
} else {
	logger.info("Running in development mode, using long polling");
	bot.start();
}

bot.on("message", async (ctx) => {
	console.log("Received message:", ctx);

	await ctx.reply("Hello! I am your Telegram bot. How can I assist you today?");
});

export { tgRoute };
