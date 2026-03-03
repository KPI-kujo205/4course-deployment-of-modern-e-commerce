import { z } from "zod";

export const envSchema = z.object({
	// DB Configuration
	DB_USER: z.string(),
	DB_PASSWORD: z.string(),
	DB_NAME: z.string(),
	DB_PORT: z.coerce.number(),
	DB_HOST: z.string(),

	TG_BOT_TOKEN: z.string().optional(),

	PORT: z.coerce.number().default(4000),
	BASE_URL: z.string(),

	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export const env = envSchema.parse(process.env);
