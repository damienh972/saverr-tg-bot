import PocketBase from "pocketbase";
import dotenv from "dotenv";
dotenv.config();

export const pb = new PocketBase(
  process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
);

// User management functions
export async function getUserByChatId(chatId: string) {
  return await pb
    .collection("users")
    .getFirstListItem(`telegram_chat_id="${chatId}"`);
}

export async function getUserByPhone(phone: string) {
  console.log("phone", phone);
  return await pb.collection("users").getFirstListItem(`phone="${phone}"`);
}

export async function linkTelegramUser(userId: string, telegramUserId: string) {
  return await pb.collection("users").update(userId, {
    telegram_user_id: telegramUserId,
  });
}

// Transaction management functions
// Retrieves all transactions for a user, excluding those in CREATED status
export async function getUserTransactions(userId: string) {
  return await pb.collection("transactions").getFullList({
    sort: "-created",
    filter: `user="${userId}" && status != "CREATED"`,
    batch: 200,
  });
}

export async function getTransactionByRef(userId: string, reference: string) {
  return await pb
    .collection("transactions")
    .getFirstListItem(`reference="${reference}" && user="${userId}"`);
}

export async function confirmTransaction(txId: string) {
  return await pb
    .collection("transactions")
    .update(txId, { status: "PROCESSING" });
}

export async function cancelTransaction(txId: string) {
  return await pb
    .collection("transactions")
    .update(txId, { status: "CANCELLED" });
}

// Notification management (for future use)
export async function createNotification(
  userId: string,
  txId: string,
  channel: "TELEGRAM" | "EMAIL",
  type: string
) {
  return await pb.collection("notifications").create({
    user: userId,
    transaction: txId,
    channel,
    type,
    status: "PENDING",
  });
}
