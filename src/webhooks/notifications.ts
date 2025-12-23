import { bot } from "../bot/telegram.js";
import { getUserByChatId } from "../db/pocketbase.js";
import { MESSAGES } from "../config/messages.js";

export async function handleTransactionWebhook(tx: any) {
  const status = tx.status;

  if (
    ![
      "AWAITING_CONFIRMATION",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ].includes(status)
  ) {
    return;
  }

  try {
    const user = await getUserByChatId(tx.user);
    const chatId = user.telegramchatid;

    if (chatId) {
      const message = MESSAGES.WEBHOOK_STATUS(
        status,
        tx.reference,
        tx.amount,
        tx.currency
      );
      await bot.sendMessage(chatId, message);
    }
  } catch {
    console.log(`No Telegram for user ${tx.user}`);
  }
}
