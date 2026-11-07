import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET muss mindestens 32 Zeichen haben'),
  COOKIE_SECURE: bool.default(true),
  SESSION_HOURS: z.coerce.number().min(1).max(48).default(12),
  HOSTD_SOCKET: z.string().default('/run/einlass/hostd.sock'),
  ADMIN_INITIAL_NAME: z.string().trim().min(2).max(50).default('admin'),
  // Touch-Display am Pi: ohne Token sind die Display-Endpunkte abgeschaltet
  DISPLAY_TOKEN: z
    .string()
    .min(24, 'DISPLAY_TOKEN muss mindestens 24 Zeichen haben')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Für den WLAN-QR-Code auf dem Display (steht dort ohnehin öffentlich)
  WIFI_SSID: z.string().optional(),
  WIFI_PASSWORD: z.string().optional(),
  APP_URL: z.string().default('https://einlass.lan'),
  ADMIN_INITIAL_PASSWORD: z
    .string()
    .min(8)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ungültige Konfiguration:\n${details}`);
  }
  return result.data;
}
