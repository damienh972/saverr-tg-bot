export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    CREATED: "En cours de validation par nos équipes",
    PROCESSING: "En attente de dépot",
    DEPOSITED: "En attente de transfert",
    TRANSFERRED: "En attente de validation finale",
    COMPLETED: "L'équipe Saverr vous remercie !",
    CANCELLED: "Votre transaction a été annulée",
    FAILED: "La transaction a échoué",
  };
  return statusMap[status] || status;
}

export function formatCurrency(currency: string): string {
  const currencyMap: Record<string, string> = {
  euro: "€",
  usd: "$",
  };
  return currencyMap[currency.toLowerCase()] || currency;
}

export const MESSAGES = {
  // Webhooks
  WEBHOOK_CREATED: (ref: string, amount: number, currency: string) =>
    `🔔 Nouvelle transaction créée \n\n📋 Référence : ${ref}\n💰 Montant : ${amount} ${formatCurrency(currency)}\n📊 Statut : ${formatStatus(
      "CREATED"
    )}`,
  WEBHOOK_PROCESSING: (ref: string) =>
    `🔄 Transaction validée par nos équipes \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "PROCESSING"
    )}`,
  WEBHOOK_DEPOSITED: (ref: string) =>
    `💼 Fonds déposés \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "DEPOSITED"
    )}`,
  WEBHOOK_TRANSFERRED: (ref: string) =>
    `🚀 Fonds transférés \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "TRANSFERRED"
    )}`,
  WEBHOOK_COMPLETED: (ref: string) =>
    `✅ Transaction terminée avec succès \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "COMPLETED"
    )}`,
  WEBHOOK_CANCELLED: (ref: string) =>
    `❌ Transaction annulée \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "CANCELLED"
    )}`,
  WEBHOOK_FAILED: (ref: string) =>
    `⚠️ Transaction échouée \n\n📋 ${ref}\n📊 Statut : ${formatStatus(
      "FAILED"
    )}`,
};
