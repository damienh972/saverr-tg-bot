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

export async function getUserByTelegramId(telegramUserId: string) {
  return await pb
    .collection("users")
    .getFirstListItem(`telegram_user_id="${telegramUserId}"`)
    .catch(() => null);
}

export async function createOrGetUser(
  phone: string,
  telegramUserId: string
): Promise<any> {
  // Try to find existing user by phone or telegram_user_id
  const existingByPhone = await pb
    .collection("users")
    .getFirstListItem(`phone="${phone}"`)
    .catch(() => null);

  if (existingByPhone) {
    // Update telegram_user_id if not set
    if (!existingByPhone.telegram_user_id) {
      return await pb.collection("users").update(existingByPhone.id, {
        telegram_user_id: telegramUserId,
      });
    }
    return existingByPhone;
  }

  const existingByTelegram = await getUserByTelegramId(telegramUserId);
  if (existingByTelegram) {
    // Update phone if not set
    if (!existingByTelegram.phone) {
      return await pb.collection("users").update(existingByTelegram.id, {
        phone,
      });
    }
    return existingByTelegram;
  }

  // Create new user if not found
  return await pb.collection("users").create({
    phone,
    telegram_user_id: telegramUserId,
    kyc_status: "DRAFT",
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
