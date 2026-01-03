import { bot } from "../bot/telegram";
import { pb } from "../db/pocketbase";
import { MESSAGES } from "../config/messages";

// Maps transaction statuses to message formatters
const webhookMessages: Record<string, (tx: any) => string> = {
  CREATED: (tx) =>
    MESSAGES.WEBHOOK_AWAITING(tx.reference, tx.amount, tx.currency),
  PROCESSING: (tx) => MESSAGES.WEBHOOK_PROCESSING(tx.reference),
  COMPLETED: (tx) => MESSAGES.WEBHOOK_COMPLETED(tx.reference),
  CANCELLED: (tx) => MESSAGES.WEBHOOK_CANCELLED(tx.reference),
  FAILED: (tx) => MESSAGES.WEBHOOK_FAILED(tx.reference),
};

// Handles transaction status updates and sends Telegram notifications
export async function handleTransactionWebhook(record: any) {
  const getMessage = webhookMessages[record.status];
  if (!getMessage) return;

  try {
    const user = await pb.collection("telegram_users").getOne(record.user);
    if (user.telegram_user_id)
      await bot.sendMessage(user.telegram_user_id, getMessage(record));
  } catch {
    console.log(`No Telegram for user ${record.user}`);
  }
}

// Handles KYC status updates and sends appropriate Telegram notifications
export async function handleKycWebhook(record: any) {
  try {
    const user = await pb.collection("telegram_users").getOne(record.id);

    if (user.telegram_user_id && record.kyc_status) {
      let message = "";

      // Generate status-specific message
      const status = record.kyc_status.toUpperCase();
      switch (status) {
        case "APPROVED":
          message =
            "✅ *KYC validé !*\nTu peux maintenant passer à l'étape suivante, RDV sur l'app Saverr.";
          break;
        case "REJECTED":
          message =
            "❌ *KYC refusé*\nContacte le support Saverr pour plus d'informations.";
          break;
        case "PENDING":
          message = "📋 *KYC soumis*\nTon dossier est en cours d'analyse.";
          break;
        default:
          message = `📊 *Statut KYC mis à jour*\nNouveau status : ${status}`;
      }

      await bot.sendMessage(user.telegram_user_id, message, {
        parse_mode: "Markdown",
      });
    }
  } catch (e) {
    console.log(`KYC notification failed for user ${record.id}:`, e);
  }
}
