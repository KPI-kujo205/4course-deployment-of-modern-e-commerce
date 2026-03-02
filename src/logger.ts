import pino from "pino";
import { env } from "@/env";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
	level: "info",
	base: {
		pid: process.pid,
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		level(label) {
			return { level: label };
		},
	},
	...(isDev && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:standard",
				ignore: "pid,hostname",
			},
		},
	}),
});
