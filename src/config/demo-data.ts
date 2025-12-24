// Demo data for transactions

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export function generateIBAN(): string {
  const checkDigits = Math.floor(Math.random() * 90) + 10;
  const bankCode = Math.floor(Math.random() * 9000) + 1000;
  const branchCode = Math.floor(Math.random() * 9000) + 1000;
  const accountNumber = Math.floor(Math.random() * 900000000000) + 100000000000;
  return `FR${checkDigits}${bankCode}${branchCode}${accountNumber
    .toString()
    .slice(0, 4)}${accountNumber.toString().slice(4, 8)}${accountNumber
    .toString()
    .slice(8, 12)}${Math.floor(Math.random() * 90) + 10}`;
}

export function generateMobileMoneyNumber(): string {
  const prefix = Math.floor(Math.random() * 900) + 100;
  const middle = Math.floor(Math.random() * 900) + 100;
  const end = Math.floor(Math.random() * 900) + 100;
  return `+243 ${prefix} ${middle} ${end}`;
}

export function generateCashAddress(): string {
  const addresses = [
    "Avenue Kasa-Vubu, Immeuble Saverr, Bureau 12, Kinshasa/Gombe",
    "Boulevard du 30 Juin, Centre Commercial, Niveau 2, Kinshasa/Gombe",
    "Avenue Batetela, Agence Saverr, Kinshasa/Lingwala",
    "Route de Matadi, Point de Service Saverr, Kinshasa/Kalamu",
  ];
  return addresses[Math.floor(Math.random() * addresses.length)];
}

export function getFundsInInstructions(fundsIn: string): string {
  switch (fundsIn) {
    case "BANK_WIRE":
      const iban = generateIBAN();
      return `\n\n💳 *IBAN de transfert :*\n\`${escapeMarkdown(
        iban
      )}\`\n\nEffectuez votre virement vers cet IBAN pour finaliser votre transaction (cela peut prendre jusqu'à 2 jours ouvrés)`;
    case "MOBILE_MONEY":
      return `\n\n📱 *Bénéficiaire :*\n${generateMobileMoneyNumber()}\n\nEnvoyez les fonds à ce numéro Mobile Money.`;
    case "CASH":
      const address = generateCashAddress();
      return `\n\n📍 *Point de dépôt :*\nVeuillez vous rendre à :\n${address}\npour déposer vos fonds.`;
    case "CRYPTO":
      return `\n\n⏳ Transfert en cours de traitement.\nVous serez notifié dès la réception des fonds.`;
    default:
      return "";
  }
}

export function getFundsOutInstructions(fundsOut: string, user: any): string {
  switch (fundsOut) {
    case "BANK_WIRE":
      const iban = user.noah_virtual_iban || "IBAN non disponible";
      return `\n\n💳 *Fonds envoyés sur votre compte :*\nIBAN : \`${escapeMarkdown(
        iban
      )}\`\n\nLes fonds ont été transférés sur votre compte bancaire.`;
    case "MOBILE_MONEY":
      const phone = user.phone || "Numéro non disponible";
      return `\n\n📱 *Fonds envoyés :*\nLes fonds ont été envoyés sur votre numéro Mobile Money : ${phone}\n\nVérifiez votre solde dans quelques instants.`;
    case "CASH":
      return `\n\n✅ Notre partenaire vous remercie de votre visite.\nLes fonds ont été remis en espèces selon les modalités convenues.`;
    case "CRYPTO":
      return `\n\n🔐 *Fonds déposés dans votre coffre numérique.*\nVos cryptomonnaies sont disponibles dans votre portefeuille.`;
    default:
      return "";
  }
}
