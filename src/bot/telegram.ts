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
  getTransactionByRef,
  confirmTransaction,
  pb,
} from "../db/pocketbase.js";

dotenv.config();

export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
  polling: true,
});

const waitingPhone = new Set<string>();

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();

  try {
    const user = await getUserByChatId(chatId);
    await showMainMenu(chatId, user);
  } catch {
    // pas encore lié
    waitingPhone.add(chatId);

    await bot.sendMessage(
      chatId,
      "🎉 Bienvenue chez Saverr Transactions 🎉\n\n" +
        "Pour sécuriser votre compte, autorisez le bot à connaître VOTRE numéro de téléphone.\n\n" +
        "👉 Appuyez sur le bouton ci‑dessous."
    );

    const keyboard: ReplyKeyboardMarkup = {
      keyboard: [[{ text: "📱 Partager mon numéro", request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    };

    const opts: SendMessageOptions = { reply_markup: keyboard };
    await bot.sendMessage(chatId, "Partagez votre numéro :", opts);
  }
});

// réception du contact
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id.toString();
  const phone = msg.contact?.phone_number;
  const telegramUserId = msg.from?.id?.toString() || "";

  if (!waitingPhone.has(chatId) || !phone) {
    return;
  }
  waitingPhone.delete(chatId);

  // on retire le keyboard
  const removeKb: ReplyKeyboardRemove = { remove_keyboard: true };
  await bot.sendMessage(chatId, "Merci, traitement en cours…", {
    reply_markup: removeKb,
  });

  try {
    const user = await getUserByPhone(phone);
    await linkTelegramUser(user.id, chatId, telegramUserId);

    await bot.sendMessage(
      chatId,
      `✅ Compte Saverr lié.\n\n📱 ${phone}\n💬 Chat ID: ${chatId}\n\n` +
        `Vous recevrez ici les mises à jour de vos transactions.`
    );

    await showMainMenu(chatId, user);
  } catch {
    await bot.sendMessage(
      chatId,
      `❌ Aucun compte Saverr trouvé avec le numéro ${phone}.\n` +
        `Vérifiez le numéro enregistré côté Saverr puis refaites /start.`
    );
  }
});

// /confirm REF
bot.onText(/\/confirm\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const reference = (match?.[1] || "").trim();

  try {
    const user = await getUserByChatId(chatId);

    const tx = await getTransactionByRef(user.id, reference);

    if (tx.status !== "AWAITING_CONFIRMATION") {
      await bot.sendMessage(
        chatId,
        `❌ ${tx.reference} n'est pas en attente de confirmation.\nStatut actuel : ${tx.status}`
      );
      return;
    }

    console.log("before confirmTransaction", tx.id);
    await confirmTransaction(tx.id);

    await bot.sendMessage(
      chatId,
      `✅ ${tx.reference} confirmée.\nStatut : PROCESSING\n\n/status ${tx.reference}`
    );
  } catch (e) {
    console.error("confirm error", e);
    await bot.sendMessage(chatId, `❌ Transaction ${reference} introuvable.`);
  }
});

// /status REF
bot.onText(/\/status\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const reference = (match?.[1] || "").trim();

  try {
    const user = await getUserByChatId(chatId);
    const tx = await getTransactionByRef(user.id, reference);
    await sendTransactionDetailsWithActions(chatId, tx);
  } catch {
    await bot.sendMessage(chatId, `❌ Transaction ${reference} introuvable.`);
  }
});

// callbacks (menu)
bot.on("callback_query", async (cb) => {
  const chatId = cb.message?.chat.id.toString() || "";
  const data = cb.data || "";
  await bot.answerCallbackQuery(cb.id);

  if (data === "my_txs") {
    await handleMyTransactions(chatId);
  } else if (data === "help") {
    await bot.sendMessage(
      chatId,
      "ℹ️ Commandes :\n/start – lier votre compte\n/confirm REF – confirmer une transaction\n/status REF – voir le détail"
    );
  } else if (data.startsWith("statusid_")) {
    const id = data.replace("statusid_", "");
    await handleStatusById(chatId, id);
  } else if (data === "confirm_tx") {
    await bot.sendMessage(
      chatId,
      "🔐 *Confirmer transaction*\n\nUtilisez :\n/confirm_TX-ABC123\n\nSeules les transactions *AWAITING_CONFIRMATION* peuvent être confirmées."
    );
  } else if (data.startsWith("confirm_")) {
    const txId = data.replace("confirm_", "");
    await handleConfirmById(chatId, txId);
  } else if (data.startsWith("statusid_")) {
    const id = data.replace("statusid_", "");
    await handleStatusById(chatId, id);
  }
});

// helpers

async function showMainMenu(chatId: string, user: any) {
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📋 Mes transactions", callback_data: "my_txs" }],
      [{ text: "ℹ️ Aide", callback_data: "help" }],
    ],
  };
  const opts: SendMessageOptions = { reply_markup: keyboard };

  await bot.sendMessage(
    chatId,
    `🏦 Saverr Transactions\n\n👤 ${
      user.phone || user.name || "Client"
    }\n\nQue souhaitez-vous faire ?`,
    opts
  );
}
async function handleConfirmById(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);

    if (tx.user !== user.id) {
      await bot.sendMessage(
        chatId,
        "❌ Cette transaction n'appartient pas à votre compte."
      );
      return;
    }
    if (tx.status !== "AWAITING_CONFIRMATION") {
      await bot.sendMessage(
        chatId,
        `❌ ${tx.reference} n'est pas en attente de confirmation.\nStatut actuel : ${tx.status}`
      );
      return;
    }

    await confirmTransaction(tx.id);
    await bot.sendMessage(
      chatId,
      `✅ ${tx.reference} confirmée.\nStatut : PROCESSING\n\n/status ${tx.reference}`
    );
  } catch (e) {
    console.error("handleConfirmById error", e);
    await bot.sendMessage(chatId, "❌ Transaction introuvable.");
  }
}

async function handleMyTransactions(chatId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const txs = await getUserTransactions(user.id);

    if (!txs.length) {
      await bot.sendMessage(chatId, "Aucune transaction en cours.");
      return;
    }

    let msg = `📋 Vos transactions (${txs.length})\n\n`;
    const buttons: { text: string; callback_data: string }[][] = [];

    txs.slice(0, 5).forEach((tx: any) => {
      msg += `• ${tx.reference} (${tx.status})\n`;
      buttons.push([
        { text: tx.reference, callback_data: `statusid_${tx.id}` },
      ]);
    });

    const keyboard: InlineKeyboardMarkup = { inline_keyboard: buttons };
    const opts: SendMessageOptions = { reply_markup: keyboard };

    await bot.sendMessage(chatId, msg, opts);
  } catch (e) {
    console.error("handleMyTransactions error", e);
    await bot.sendMessage(chatId, "⚠️ Faites /start pour lier votre compte.");
  }
}

async function handleStatusById(chatId: string, txId: string) {
  try {
    const user = await getUserByChatId(chatId);
    const tx = await pb.collection("transactions").getOne(txId);
    if (tx.user !== user.id) {
      await bot.sendMessage(
        chatId,
        "❌ Cette transaction n’appartient pas à votre compte."
      );
      return;
    }
    await sendTransactionDetailsWithActions(chatId, tx);
  } catch {
    await bot.sendMessage(chatId, "❌ Transaction introuvable.");
  }
}

function formatTransactionDetails(tx: any): string {
  let s =
    `📋 Transaction ${tx.reference}\n\n` +
    `💰 Montant : ${tx.amount} ${tx.currency}\n` +
    `📤 Funds IN : ${tx.funds_in}\n` +
    `📥 Funds OUT : ${tx.funds_out}\n` +
    `📊 Statut : ${tx.status}\n\n`;

  if (tx.status === "PROCESSING") {
    s += `📍 Instructions de paiement à compléter selon funds_in/funds_out.\n`;
  }

  if (tx.status === "AWAITING_CONFIRMATION") {
    s += `\nVous pouvez confirmer cette transaction ci‑dessous.`;
  }
  return s;
}

async function sendTransactionDetailsWithActions(chatId: string, tx: any) {
  const text = formatTransactionDetails(tx);

  // Si en attente de confirmation → ajoute bouton
  let opts: SendMessageOptions = {};
  if (tx.status === "AWAITING_CONFIRMATION") {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: "✅ Confirmer cette transaction",
            callback_data: `confirm_${tx.id}`,
          },
        ],
      ],
    };
    opts = { reply_markup: keyboard };
  }

  await bot.sendMessage(chatId, text, opts);
}
