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

export const MESSAGES = {
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
};
