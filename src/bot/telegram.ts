import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";

// Initialize Telegram bot with polling enabled
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Handle /start command - sends welcome message to users
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "Bienvenue. Utilise le bouton Menu pour ouvrir Saverr."
  );
});
