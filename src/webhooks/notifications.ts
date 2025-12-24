import { bot } from "../bot/telegram";
import { pb } from "../db/pocketbase";
import { MESSAGES } from "../config/messages";

const webhookMessages: Record<string, (tx: any) => string> = {
  AWAITING_CONFIRMATION: (tx) =>
    MESSAGES.WEBHOOK_AWAITING(tx.reference, tx.amount, tx.currency),
  PROCESSING: (tx) => MESSAGES.WEBHOOK_PROCESSING(tx.reference),
  COMPLETED: (tx) => MESSAGES.WEBHOOK_COMPLETED(tx.reference),
  CANCELLED: (tx) => MESSAGES.WEBHOOK_CANCELLED(tx.reference),
  FAILED: (tx) => MESSAGES.WEBHOOK_FAILED(tx.reference),
};

export async function handleTransactionWebhook(tx: any) {
  const getMessage = webhookMessages[tx.status];
  if (!getMessage) return;

  try {
    const user = await pb.collection("users").getOne(tx.user);
    if (user.telegram_chat_id)
      await bot.sendMessage(user.telegram_chat_id, getMessage(tx));
  } catch {
    console.log(`No Telegram for user ${tx.user}`);
  }
}
