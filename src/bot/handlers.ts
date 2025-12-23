import { bot } from "./telegram";
import {
  getUserByChatId,
  getUserByPhone,
  linkTelegramUser,
  getUserTransactions,
  getTransactionByRef,
  confirmTransaction,
  pb,
} from "../db/pocketbase";
import { MESSAGES } from "../config/messages";
import type {
  SendMessageOptions,
  InlineKeyboardMarkup,
} from "node-telegram-bot-api";

const waitingPhone = new Map<string, boolean>();

export async function handleStart(chatId: string) {
  try {
    const user = await getUserByChatId(chatId);
    showMainMenu(chatId, user);
  } catch {
    if (waitingPhone.has(chatId)) return;
    waitingPhone.set(chatId, true);

    await bot.sendMessage(chatId, MESSAGES.WELCOME);

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: "📱 Lier mon compte Saverr",
            callback_data: "link_account",
          },
        ],
      ],
    };
    const options: SendMessageOptions = { reply_markup: keyboard };
    await bot.sendMessage(chatId, "Cliquez :", options);
  }
}

export async function handleContact(
  chatId: string,
  phone: string,
  telegramUserId: string
) {
  waitingPhone.delete(chatId);

  try {
    const user = await getUserByPhone(phone);
    await linkTelegramUser(user.id, chatId, telegramUserId);

    await bot.sendMessage(chatId, MESSAGES.LINK_SUCCESS(phone, chatId));
    showMainMenu(chatId, user);
  } catch {
    await bot.sendMessage(chatId, MESSAGES.ACCOUNT_NOT_FOUND(phone));
  }
}

export async function handleConfirm(chatId: string, reference: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await getTransactionByRef(user.id, reference);

    if (tx.status !== "AWAITING_CONFIRMATION") {
      await bot.sendMessage(
        chatId,
        `❌ ${reference} n'est pas en attente de confirmation. Statut: ${tx.status}`
      );
      return;
    }

    await confirmTransaction(tx.id);
    await bot.sendMessage(chatId, MESSAGES.CONFIRM_SUCCESS(reference));
  } catch {
    await bot.sendMessage(chatId, MESSAGES.TX_NOT_FOUND(reference));
  }
}

export async function handleStatus(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);

    if (tx.user !== user.id) {
      await bot.sendMessage(chatId, "❌ Pas vos droits sur cette transaction.");
      return;
    }
    await bot.sendMessage(
      chatId,
      `📊 Transaction ${tx.reference}: ${tx.status}`
    );
  } catch {
    await bot.sendMessage(chatId, "❌ Transaction introuvable.");
  }
}

function showMainMenu(chatId: string, user: any) {
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📋 Mes transactions", callback_data: "my_txs" }],
      [{ text: "🔐 Confirmer transaction", callback_data: "confirm_tx" }],
      [{ text: "ℹ️ Aide", callback_data: "help" }],
    ],
  };
  const options: SendMessageOptions = { reply_markup: keyboard };
  bot.sendMessage(
    chatId,
    MESSAGES.MAIN_MENU(user.phone || user.name || "Client"),
    options
  );
}
