import TelegramBot, {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  SendMessageOptions,
} from "node-telegram-bot-api";
import dotenv from "dotenv";
import {
  getUserByChatId,
  getUserByPhone,
  linkTelegramUser,
  getUserTransactions,
  confirmTransaction,
  cancelTransaction,
  pb,
} from "../db/pocketbase.js";
import { MESSAGES, formatStatus, formatFundsType } from "../config/messages.js";
import {
  getFundsInInstructions,
  getFundsOutInstructions,
} from "../config/demo-data.js";

function escapeMarkdown(text: string): string {
  if (!text) return "";
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

dotenv.config();

export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
  polling: true,
});

const waitingPhone = new Set<string>();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();

  try {
    const user = await getUserByChatId(chatId);
    await showMainMenu(chatId, user);
  } catch {
    waitingPhone.add(chatId);
    await bot.sendMessage(chatId, MESSAGES.WELCOME);

    const keyboard: ReplyKeyboardMarkup = {
      keyboard: [[{ text: "📱 Partager mon numéro", request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    };

    await bot.sendMessage(chatId, MESSAGES.SHARE_PHONE, {
      reply_markup: keyboard,
    });
  }
});

bot.on("contact", async (msg) => {
  const chatId = msg.chat.id.toString();
  const phone = `+${msg.contact?.phone_number}`;
  const telegramUserId = msg.from?.id?.toString() || "";

  if (!waitingPhone.has(chatId) || !phone) return;

  waitingPhone.delete(chatId);

  await bot.sendMessage(chatId, MESSAGES.PROCESSING_LINK, {
    reply_markup: { remove_keyboard: true } as ReplyKeyboardRemove,
  });

  try {
    const user = await getUserByPhone(phone);

    await linkTelegramUser(user.id, chatId, telegramUserId);
    await bot.sendMessage(chatId, MESSAGES.LINK_SUCCESS(phone));
    await showMainMenu(chatId, user);
  } catch {
    await bot.sendMessage(chatId, MESSAGES.ACCOUNT_NOT_FOUND(phone));
  }
});

bot.on("callback_query", async (cb) => {
  const chatId = cb.message?.chat.id.toString() || "";
  const data = cb.data || "";
  await bot.answerCallbackQuery(cb.id);

  if (data === "my_txs") {
    await handleMyTransactions(chatId);
  } else if (data === "help") {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]],
    };
    await bot.sendMessage(chatId, MESSAGES.HELP, { reply_markup: keyboard });
  } else if (data === "menu") {
    try {
      const user = await getUserByChatId(chatId);
      await showMainMenu(chatId, user);
    } catch {
      await bot.sendMessage(chatId, MESSAGES.USER_NOT_LINKED);
    }
  } else if (data.startsWith("statusid_")) {
    await handleStatusById(chatId, data.replace("statusid_", ""));
  } else if (data.startsWith("confirm_")) {
    await handleConfirmById(chatId, data.replace("confirm_", ""));
  } else if (data.startsWith("cancel_")) {
    await handleCancelById(chatId, data.replace("cancel_", ""));
  }
});

async function showMainMenu(chatId: string, user: any) {
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📋 Mes transactions", callback_data: "my_txs" }],
      [{ text: "ℹ️ Aide", callback_data: "help" }],
    ],
  };

  await bot.sendMessage(
    chatId,
    MESSAGES.MAIN_MENU(user.phone || user.name || "Client"),
    {
      reply_markup: keyboard,
    }
  );
}

async function handleConfirmById(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);

    if (tx.user !== user.id) {
      await bot.sendMessage(chatId, MESSAGES.TX_NOT_OWNED);
      return;
    }

    if (tx.status !== "AWAITING_CONFIRMATION") {
      await bot.sendMessage(
        chatId,
        MESSAGES.CONFIRM_INVALID_STATUS(tx.reference, tx.status)
      );
      return;
    }

    await confirmTransaction(tx.id);
    await bot.sendMessage(chatId, MESSAGES.CONFIRM_SUCCESS(tx.reference));

    const txUpdated = await pb.collection("transactions").getOne(txId);
    await sendTransactionDetails(chatId, txUpdated, user);
  } catch {
    await bot.sendMessage(chatId, MESSAGES.TX_NOT_FOUND(""));
  }
}

async function handleMyTransactions(chatId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const txs = await getUserTransactions(user.id);

    if (!txs.length) {
      await bot.sendMessage(chatId, MESSAGES.NO_TRANSACTIONS);
      return;
    }

    const msg =
      MESSAGES.TRANSACTIONS_LIST(txs.length) +
      txs
        .slice(0, 5)
        .map((tx: any) => MESSAGES.TRANSACTION_ITEM(tx.reference, tx.status))
        .join("\n");

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: txs
        .slice(0, 5)
        .map((tx: any) => [
          { text: `📋 ${tx.reference}`, callback_data: `statusid_${tx.id}` },
        ]),
    };

    await bot.sendMessage(chatId, msg, { reply_markup: keyboard });
  } catch {
    await bot.sendMessage(chatId, MESSAGES.USER_NOT_LINKED);
  }
}

async function handleStatusById(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);

    if (tx.user !== user.id) {
      await bot.sendMessage(chatId, MESSAGES.TX_NOT_OWNED);
      return;
    }

    await sendTransactionDetails(chatId, tx, user);
  } catch {
    await bot.sendMessage(chatId, MESSAGES.TX_NOT_FOUND(""));
  }
}

async function sendTransactionDetails(chatId: string, tx: any, user: any) {
  let text =
    `📋 *Transaction ${tx.reference}*\n\n` +
    `💰 Montant : ${escapeMarkdown(tx.amount)} ${escapeMarkdown(
      tx.currency
    )}\n` +
    `📤 Dépot : ${escapeMarkdown(formatFundsType(tx.funds_in))}\n` +
    `📥 Retrait : ${escapeMarkdown(formatFundsType(tx.funds_out))}\n` +
    `📊 Statut : ${escapeMarkdown(formatStatus(tx.status))}\n`;

  if (tx.status === "PROCESSING") {
    text += getFundsInInstructions(tx.funds_in);
  } else if (tx.status === "COMPLETED" || tx.status === "VALIDATED") {
    text += getFundsOutInstructions(tx.funds_out, user);
  } else if (tx.status === "AWAITING_CONFIRMATION") {
    text += MESSAGES.TX_AWAITING_CONFIRM;
  }

  const opts: SendMessageOptions = {};

  if (tx.status === "AWAITING_CONFIRMATION") {
    opts.reply_markup = {
      inline_keyboard: [
        [
          { text: MESSAGES.CONFIRM_BUTTON, callback_data: `confirm_${tx.id}` },
          { text: MESSAGES.CANCEL_BUTTON, callback_data: `cancel_${tx.id}` },
        ],
      ],
    } as InlineKeyboardMarkup;
  }

  await bot.sendMessage(chatId, text, { ...opts, parse_mode: "Markdown" });
}

async function handleCancelById(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);

    if (tx.user !== user.id) {
      await bot.sendMessage(chatId, MESSAGES.TX_NOT_OWNED);
      return;
    }

    if (tx.status !== "AWAITING_CONFIRMATION") {
      await bot.sendMessage(
        chatId,
        MESSAGES.CONFIRM_INVALID_STATUS(tx.reference, tx.status)
      );
      return;
    }

    await cancelTransaction(tx.id);
    await bot.sendMessage(chatId, MESSAGES.CANCEL_SUCCESS(tx.reference));
  } catch {
    await bot.sendMessage(chatId, MESSAGES.TX_NOT_FOUND(""));
  }
}
