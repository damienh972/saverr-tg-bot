export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    CREATED: "Créée",
    AWAITING_CONFIRMATION: "En attente de confirmation",
    PROCESSING: "En cours de traitement",
    VALIDATED: "Validée",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
    FAILED: "Échouée",
  };
  return statusMap[status] || status;
}

export function formatFundsType(funds: string): string {
  const fundsMap: Record<string, string> = {
    BANK_WIRE: "Virement bancaire",
    MOBILE_MONEY: "Mobile Money",
    CASH: "Espèces",
    CRYPTO: "Cryptomonnaie",
    CARD: "Carte bancaire",
  };
  return fundsMap[funds] || funds;
}

export const MESSAGES = {
  // Onboarding
  WELCOME: `🎉 *Bienvenue chez Saverr Transactions* 🎉\n\nPour sécuriser votre compte, autorisez le bot à connaître votre numéro de téléphone.\n\n👉 Appuyez sur le bouton ci-dessous.`,
  SHARE_PHONE: "Partagez votre numéro :",
  PROCESSING_LINK: "Merci, traitement en cours…",
  LINK_SUCCESS: (phone: string) =>
    `✅ *Compte Saverr lié !*\n\n📱 ${phone}\n\nVous recevrez ici les mises à jour de vos transactions.`,
  ACCOUNT_NOT_FOUND: (phone: string) =>
    `❌ Aucun compte Saverr trouvé avec le numéro ${phone}.\n\nVérifiez le numéro enregistré côté Saverr puis refaites /start.`,

  // Menu
  MAIN_MENU: (user: string) =>
    `🏦 *Saverr Transactions*\n\n👤 ${user}\n\nQue souhaitez-vous faire ?`,

  // Transactions
  NO_TRANSACTIONS: "Aucune transaction en cours.",
  TRANSACTIONS_LIST: (count: number) => `📋 *Vos transactions* (${count})\n\n`,
  TRANSACTION_ITEM: (ref: string, status: string) =>
    `• ${ref} - ${formatStatus(status)}`,
  TX_DETAILS: (tx: any) =>
    `📋 *Transaction ${tx.reference}*\n\n` +
    `💰 Montant : ${tx.amount} ${tx.currency}\n` +
    `📤 Dépot : ${formatFundsType(tx.funds_in)}\n` +
    `📥 Retrait : ${formatFundsType(tx.funds_out)}\n` +
    `📊 Statut : ${formatStatus(tx.status)}\n`,
  TX_AWAITING_CONFIRM: `\n\nVous pouvez confirmer ou annuler cette transaction ci-dessous.`,
  CONFIRM_BUTTON: "✅ Confirmer",
  CANCEL_BUTTON: "❌ Annuler",
  CONFIRM_SUCCESS: (ref: string) =>
    `✅ *Transaction ${ref} confirmée*\n\nStatut : ${formatStatus(
      "PROCESSING"
    )}`,
  CANCEL_SUCCESS: (ref: string) =>
    `❌ *Transaction ${ref} annulée*\n\nStatut : ${formatStatus("CANCELLED")}`,
  CONFIRM_INVALID_STATUS: (ref: string, status: string) =>
    `❌ ${ref} n'est pas en attente de confirmation.\nStatut actuel : ${formatStatus(
      status
    )}`,
  TX_NOT_OWNED: "❌ Cette transaction n'appartient pas à votre compte.",

  // Webhooks
  WEBHOOK_AWAITING: (ref: string, amount: number, currency: string) =>
    `🔔 *Nouvelle transaction à confirmer*\n\n📋 Référence : ${ref}\n💰 Montant : ${amount} ${currency}\n📊 Statut : ${formatStatus(
      "AWAITING_CONFIRMATION"
    )}\n\n👉 Consultez "Mes transactions" pour confirmer ou annuler`,
  WEBHOOK_PROCESSING: (ref: string) =>
    `🔄 *Transaction en cours*\n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "PROCESSING"
    )}`,
  WEBHOOK_COMPLETED: (ref: string) =>
    `✅ *Transaction terminée*\n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "COMPLETED"
    )}`,
  WEBHOOK_CANCELLED: (ref: string) =>
    `❌ *Transaction annulée*\n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "CANCELLED"
    )}`,
  WEBHOOK_FAILED: (ref: string) =>
    `⚠️ *Transaction échouée*\n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "FAILED"
    )}`,

  // Errors
  USER_NOT_LINKED: "⚠️ Faites /start pour lier votre compte.",
  TX_NOT_FOUND: (ref: string) => `❌ Transaction ${ref} introuvable.`,
  ERROR_GENERIC: "❌ Une erreur est survenue. Veuillez réessayer.",
  HELP: `ℹ️ *Aide*\n\nUtilisez les boutons du menu pour naviguer et gérer vos transactions.`,
};
