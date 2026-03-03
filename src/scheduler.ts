import { schedule, validate } from "node-cron";
import { logger } from "@/logger";
import { bot } from "@/routers/tg.route";
import { processReminders } from "@/services/reminder.service";

// Run at the top of every hour — the reminder service internally filters
// for users whose local time is currently midnight (00:xx).
const CRON_EXPRESSION = "0 * * * *";

/**
 * Start the hourly reminder cron job.
 * Returns a stop function to be called during graceful shutdown.
 */
export function startScheduler(): () => void {
	if (!validate(CRON_EXPRESSION)) {
		throw new Error(`Invalid cron expression: ${CRON_EXPRESSION}`);
	}

	const task = schedule(CRON_EXPRESSION, async () => {
		logger.info("Cron: running reminder check");
		try {
			if (bot) {
				// @ts-expect-error: ts tells bs
				await processReminders(bot);
			}
		} catch (err) {
			logger.error({ err }, "Cron: unhandled error in processReminders");
		}
	});

	logger.info("Reminder scheduler started (runs every hour)");

	return () => {
		task.stop();
		logger.info("Reminder scheduler stopped");
	};
}
