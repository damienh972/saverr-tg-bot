export const MESSAGES = {
  // Onboarding
  WELCOME: `🎉 *Bienvenue chez Saverr Transactions* 🎉\n\nPour gérer vos transactions, liez ce bot :\n\n📱 Partagez votre numéro (identique à votre profil Saverr)`,
  LINK_SUCCESS: (phone: string, chatId: string) =>
    `✅ *Compte Saverr lié !*\n\n📱 ${phone}\n💬 ${chatId}\n\n🚀 Prêt pour vos transactions !`,

  // Menu
  MAIN_MENU: (user: string) =>
    `🏦 *Saverr Transactions* - Menu principal\n\n👤 ${user}\n\nQue souhaitez-vous faire ?`,

  // Transactions
  NO_TRANSACTIONS: "Aucune transaction en cours.",
  CONFIRM_INSTRUCTIONS: `🔐 *Confirmer transaction*\n\nUtilisez :\n/confirm TX-ABC123\n\nSeules les transactions *AWAITING_CONFIRMATION* peuvent être confirmées.`,
  CONFIRM_SUCCESS: (ref: string) =>
    `✅ *${ref} confirmée !*\n\nStatut: PROCESSING\n\nDétails : /status ${ref}`,

  // Webhooks
  WEBHOOK_STATUS: (
    status: string,
    ref: string,
    amount: number,
    currency: string
  ) =>
    `🔔 *${status.toUpperCase()}*\n\n📋 ${ref}\n💰 ${amount} ${currency}\n📊 ${status}\n\n👉 /status ${ref}`,

  // Errors
  USER_NOT_LINKED: "⚠️ Faites /start pour lier votre compte.",
  TX_NOT_FOUND: (ref: string) =>
    `❌ Transaction ${ref} non trouvée.\nVérifiez la référence ou vos permissions.`,
  ACCOUNT_NOT_FOUND: (phone: string) =>
    `❌ Compte ${phone} non trouvé.\n\n👉 Vérifiez votre numéro ou contactez support@saverr.com`,
  HELP: `ℹ️ *Commandes Saverr*\n\n• /start - Lier compte\n• /confirm REF - Confirmer tx\n• /status REF - Détails tx\n\n💬 support@saverr.com`,
};
