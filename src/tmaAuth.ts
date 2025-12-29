import crypto from "node:crypto";

export type TmaUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

/**
 * Validates Telegram Mini App initData using HMAC-SHA256 signature verification
 * Implements Telegram's authentication protocol for Mini Apps
 */
export function validateInitDataRaw(initDataRaw: string, botToken: string) {
  if (!initDataRaw) return { ok: false as const, reason: "missing_init_data" };

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) return { ok: false as const, reason: "missing_hash" };

  params.delete("hash");

  // Sort parameters alphabetically and create data check string
  const pairs: string[] = [];
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [k, v] of entries) pairs.push(`${k}=${v}`);
  const dataCheckString = pairs.join("\n");

  // Compute HMAC-SHA256 signature using bot token
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  if (computedHash !== hash) return { ok: false as const, reason: "bad_hash" };

  // Extract and parse user data from initData
  const userStr = new URLSearchParams(initDataRaw).get("user");
  let user: TmaUser | undefined;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      user = {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        username: u.username,
      };
    } catch {}
  }

  return { ok: true as const, user, initDataRaw };
}
