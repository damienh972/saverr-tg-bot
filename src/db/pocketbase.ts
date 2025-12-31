import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { v7 as uuidv7 } from 'uuid';
dotenv.config();

export const pb = new PocketBase(
  process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
);

// User management functions using telegram_users collection
export async function getUserByChatId(chatId: string) {
  return await pb
    .collection("telegram_users")
    .getFirstListItem(`telegram_chat_id="${chatId}"`);
}

export async function getUserByPhone(phone: string) {
  console.log("phone", phone);
  return await pb
    .collection("telegram_users")
    .getFirstListItem(`phone="${phone}"`);
}

export async function linkTelegramUser(userId: string, telegramUserId: string) {
  return await pb.collection("telegram_users").update(userId, {
    telegram_user_id: telegramUserId,
  });
}

export async function getUserByTelegramId(telegramUserId: string) {
  return await pb
    .collection("telegram_users")
    .getFirstListItem(`telegram_user_id="${telegramUserId}"`)
    .catch(() => null);
}

export async function createOrGetUser(
  phone: string,
  telegramUserId: string
): Promise<any> {
  // Try to find existing user by phone or telegram_user_id
  const existingByPhone = await pb
    .collection("telegram_users")
    .getFirstListItem(`phone="${phone}"`)
    .catch(() => null);

  if (existingByPhone) {
    // Update telegram_user_id and noah_customer_id if not set
    const updates: any = {};
    if (!existingByPhone.telegram_user_id) {
      updates.telegram_user_id = telegramUserId;
    }
    if (!existingByPhone.noah_customer_id) {
      updates.noah_customer_id = uuidv7();
    }
    if (Object.keys(updates).length > 0) {
      return await pb.collection("telegram_users").update(existingByPhone.id, updates);
    }
    return existingByPhone;
  }

  const existingByTelegram = await getUserByTelegramId(telegramUserId);
  if (existingByTelegram) {
    // Update phone and noah_customer_id if not set
    const updates: any = {};
    if (!existingByTelegram.phone) {
      updates.phone = phone;
    }
    if (!existingByTelegram.noah_customer_id) {
      updates.noah_customer_id = uuidv7();
    }
    if (Object.keys(updates).length > 0) {
      return await pb.collection("telegram_users").update(existingByTelegram.id, updates);
    }
    return existingByTelegram;
  }

  // Create new user if not found
  return await pb.collection("telegram_users").create({
    phone,
    telegram_user_id: telegramUserId,
    kyc_status: "DRAFT",
    noah_customer_id: uuidv7()
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
