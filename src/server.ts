import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  handleTransactionWebhook,
  handleKycWebhook,
} from "./webhooks/notifications.js";
import {
  pb,
  getUserTransactions,
  createOrGetUser,
} from "./db/pocketbase.js";
import { noahClient } from "./services/noah.js";
import { validateInitDataRaw } from "./tmaAuth.js";

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://demoapp.saverr.io",
      "https://posingly-abrogable-audry.ngrok-free.dev",
      "https://pseudogyrate-pleuritic-lesia.ngrok-free.dev",
      "https://emelina-nonoxidating-keren.ngrok-free.dev",
    ],
  })
);
app.use(express.json({ limit: "1mb" }));

// WebSocket hub: maps telegram_user_id to active WebSocket connections
const socketsByTelegramUserId = new Map<number, Set<WebSocket>>();

// Formats date fields in PocketBase records to Paris timezone ISO strings
function formatDates(record: any): any {
  if (!record) return record;

  const formatted = { ...record };

  // Format created and updated dates to Europe/Paris timezone if they exist
  if (formatted.created) {
    formatted.created = new Date(formatted.created).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
  if (formatted.updated) {
    formatted.updated = new Date(formatted.updated).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  return formatted;
}

// Formats date fields in an array of PocketBase records
function formatDatesArray(records: any[]): any[] {
  return records.map(formatDates);
}

// Broadcasts a message to all active WebSocket connections for a given Telegram user
function wsBroadcast(telegramUserId: number, payload: unknown) {
  const set = socketsByTelegramUserId.get(telegramUserId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}

// Middleware to authenticate Telegram Mini App requests
// Expects Authorization header: "tma <initDataRaw>"
function requireTma(req: any, res: any, next: any) {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("tma "))
    return res.status(401).json({ error: "missing_auth" });

  const initDataRaw = auth.slice(4);
  const check = validateInitDataRaw(
    initDataRaw,
    process.env.TELEGRAM_BOT_TOKEN!
  );
  if (!check.ok) return res.status(401).json({ error: check.reason });

  // Attach validated user data to request object
  req.tma = check; // { user, initDataRaw }
  next();
}

// Webhook endpoint for transaction status updates from external services
app.post("/webhook/transactions", async (req, res) => {
  try {
    const { record } = req.body;
    await handleTransactionWebhook(record);
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Error");
  }
});

// Webhook endpoint for user updates from PocketBase
// Note: WebSocket broadcast is now handled by /webhook/noah/customer to avoid duplication
app.post("/webhook/users", async (req, res) => {
  try {
    console.log("Received PocketBase user webhook", req.body);
    const payload = req.body as any;
    const record = payload?.record;

    // Handle other notification logic (e.g., email, Telegram bot messages)
    await handleKycWebhook(record);
    res.json({ ok: true });
  } catch (e) {
    console.error("PocketBase webhook error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Webhook endpoint for Noah customer verification updates
// Receives events from Noah when customer verification status changes
app.post("/webhook/noah/customer", async (req, res) => {
  try {
    console.log("Received Noah customer webhook:", JSON.stringify(req.body, null, 2));

    const { EventType, Data } = req.body;

    // Extract customer ID and verification status from webhook payload
    const customerId = Data?.CustomerID;

    // Noah uses both old Verification and new Verifications fields
    const verificationStatus = Data?.Verifications?.Status || Data?.Verification?.Status;

    if (!customerId) {
      console.error("Missing CustomerID in Noah webhook");
      return res.status(400).json({ error: "missing_customer_id" });
    }

    console.log(`Processing Noah webhook for customer: ${customerId}, status: ${verificationStatus}, event: ${EventType}`);

    // Find user by noah_customer_id
    const user = await pb
      .collection("telegram_users")
      .getFirstListItem(`noah_customer_id="${customerId}"`)
      .catch(() => null);

    if (!user) {
      console.warn(`User not found for noah_customer_id: ${customerId}`);
      return res.status(404).json({ error: "user_not_found" });
    }

    // Map Noah verification status to our kyc_status
    // Noah statuses: Approved, Pending, Declined
    let kycStatus = "DRAFT";
    if (verificationStatus === "Approved") {
      kycStatus = "APPROVED";
    } else if (verificationStatus === "Declined") {
      kycStatus = "REJECTED";
    } else if (verificationStatus === "Pending") {
      kycStatus = "PENDING";
    }

    console.log(`Updating user ${user.id} kyc_status from ${user.kyc_status} to ${kycStatus}`);

    // Update user kyc_status in PocketBase
    await pb.collection("telegram_users").update(user.id, {
      kyc_status: kycStatus,
    });

    // Broadcast update to connected WebSocket clients
    if (user.telegram_user_id) {
      const telegramUserId = Number(user.telegram_user_id);
      wsBroadcast(telegramUserId, {
        type: "kyc_updated",
        kyc_status: kycStatus,
      });
      console.log(`Broadcasted KYC update to Telegram user: ${telegramUserId}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Noah customer webhook error:", error);
    res.status(500).json({ error: "internal_error" });
  }
});

// API endpoint to get current authenticated user's profile
app.get("/api/me", requireTma, async (req: any, res) => {
  try {
    const telegramUserId = req.tma.user?.id;
    if (!telegramUserId) return res.json({ user: null });

    const user = await pb
      .collection("telegram_users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`)
      .catch(() => null);

    res.json({ user: formatDates(user) });
  } catch (e) {
    console.error("Error fetching user:", e);
    res.status(500).json({ error: "failed_to_fetch_user" });
  }
});

app.get("/api/transactions", requireTma, async (req: any, res) => {
  try {
    const telegramUserId = req.tma.user?.id;
    if (!telegramUserId) return res.json({ transactions: [] });

    const user = await pb
      .collection("telegram_users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`)
      .catch(() => null);

    if (!user) return res.json({ transactions: [] });

    const txs = await getUserTransactions(user.id).catch(() => []);
    res.json({ transactions: formatDatesArray(txs) });
  } catch (e) {
    console.error("Error fetching transactions:", e);
    res.status(500).json({ error: "failed_to_fetch_transactions" });
  }
});

// Updates the status of a specific transaction
app.post("/api/transaction/:id/status", requireTma, async (req: any, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // Expected: "CONFIRMED" | "CANCELLED"

    const record = await pb.collection("transactions").update(id, { status });
    res.json({ ok: true, transaction: formatDates(record) });
  } catch (e) {
    console.error("Error updating transaction status:", e);
    res.status(500).json({ error: "failed_to_update_status" });
  }
});

// Simulate Deposited for transaction
app.post("/api/transaction/:id/simulate_deposit", requireTma, async (req: any, res) => {
  try {
    const id = req.params.id;

    const record = await pb.collection("transactions").update(id, { status: "DEPOSITED" });
    console.log(`transaction id : ${id}  DEPOSITED`);
    res.json({ ok: true, transaction: formatDates(record) });
  } catch (e) {
    console.error("Error updating transaction status:", e);
    res.status(500).json({ error: "failed_to_update_status" });
  }
});

// Creates a new transaction record
app.post("/api/transaction/submit", requireTma, async (req: any, res) => {
  try {
    const transactionData = req.body;
    const telegramUserId = req.tma.user?.id;

    const user = await pb
      .collection("telegram_users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`);

    // Generate unique transaction reference and set initial status
    transactionData.reference =
      "tx_ref_" + Math.random().toString(36).substring(2, 10);
    transactionData.user = user.id;
    transactionData.status = "CREATED";

    const record = await pb.collection("transactions").create(transactionData);

    res.json({
      ok: true,
      transaction_id: record.id,
      transaction: formatDates(record),
      message: "Transaction créée avec succès",
    });
  } catch (e) {
    console.error("Error creating transaction:", e);
    res.status(500).json({ error: "failed_to_create_transaction" });
  }
});

// Creates or retrieves user in PocketBase and generates Noah KYC onboarding URL
app.post("/api/onboarding", requireTma, async (req: any, res) => {
  console.log("Received /api/onboarding request", req.body);

  try {
    const telegramUserId = String(req.tma.user?.id);
    const phone = req.body?.phone_number;
    const returnURL = req.body?.returnURL;
    const fiatCurrencies = req.body?.fiatCurrencies || ["EUR"];

    if (!telegramUserId || !phone) {
      return res
        .status(400)
        .json({ error: "missing telegram_user_id or phone_number" });
    }

    // Create or get user in PocketBase
    const user = await createOrGetUser(phone, telegramUserId);
    console.log(`User created/found: ${user.id}`);

    // Ensure user has noah_customer_id
    if (!user.noah_customer_id) {
      console.error("User missing noah_customer_id");
      return res.status(500).json({ error: "user_configuration_error" });
    }

    // Check if Noah client is available
    if (!noahClient) {
      console.warn("Noah client not configured, returning mock URL");
      const mockUrl = `https://mock-kyc.saverr.io/onboarding?customer_id=${user.noah_customer_id}&phone=${encodeURIComponent(phone)}`;
      return res.json({ onboardingUrl: mockUrl });
    }

    // Call Noah to create onboarding session
    const fiatOptions = fiatCurrencies.map((currency: string) => ({
      FiatCurrencyCode: currency,
    }));

    const noahResponse = await noahClient.createOnboardingSession(user.noah_customer_id, {
      ReturnURL:
        returnURL || `${process.env.WEBAPP_URL || "https://saverr.io"}`,
      FiatOptions: fiatOptions,
      Metadata: {
        telegram_user_id: telegramUserId,
        phone,
        source: "telegram_webapp",
      },
    });

    console.log(`Noah onboarding URL created for user ${user.id}`);

    res.json({ onboardingUrl: noahResponse.HostedURL });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    res.status(500).json({
      error: error.message || "failed_to_create_onboarding_session",
    });
  }
});

// Mock endpoint: creates a wallet address and generates a mock IBAN for the user
app.post("/api/wallet", requireTma, async (req: any, res) => {
  console.log("Received /api/wallet request", req.body);
  const telegramUserId = req.tma.user?.id;
  const address = req.body?.address;

  if (!telegramUserId || !address) {
    return res
      .status(400)
      .json({ error: "missing telegram_user_id or address" });
  }

  try {
    // Find user by telegram_user_id
    const user = await pb
      .collection("telegram_users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`);

      const iban = `FR76${Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase()}1234567890123`;
    // Update user record with wallet address and generate mock IBAN
    await pb.collection("telegram_users").update(user.id, {
      user_tw_eoa: address,
      noah_virtual_iban: iban ,
    });

    console.log(`Mock wallet created for user ${telegramUserId}: ${address}`);

    res.json({
      ok: true,
      noah_virtual_iban: iban,
      message: "Wallet et IBAN mock créés !",
    });
  } catch (e) {
    console.error(`Mock wallet error for ${telegramUserId}:`, e);
    res.status(500).json({ error: "user not found" });
  }
});

// Initialize HTTP server and WebSocket server
const server = http.createServer(app);

// WebSocket server for real-time communication with Telegram Mini App clients
// Clients authenticate using initData query parameter (Telegram Mini App authentication)
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);

  // Extract and validate Telegram Mini App initData
  const initData = url.searchParams.get("initData") || "";
  const check = validateInitDataRaw(initData, process.env.TELEGRAM_BOT_TOKEN!);

  if (!check.ok || !check.user?.id) {
    console.log("❌ WS rejected - invalid auth");
    return ws.close(1008, "unauthorized");
  }

  const telegramUserId = Number(check.user.id);

  // Register this WebSocket connection for the user
  let userSockets = socketsByTelegramUserId.get(telegramUserId);
  if (!userSockets) {
    userSockets = new Set<WebSocket>();
    socketsByTelegramUserId.set(telegramUserId, userSockets);
  }

  userSockets.add(ws);

  console.log("🔗 WS added successfully. Total sockets:", userSockets.size);

  // Clean up on connection close
  ws.on("close", () => {
    console.log("🔌 WS closed for user:", telegramUserId);
    const s = socketsByTelegramUserId.get(telegramUserId);
    if (s) {
      s.delete(ws);
      if (s.size === 0) {
        socketsByTelegramUserId.delete(telegramUserId);
        console.log("🗑️ Removed empty sockets set for user:", telegramUserId);
      }
    }
  });

  // Send welcome message to newly connected client
  console.log("✨ Sending hello to user:", telegramUserId);
  ws.send(JSON.stringify({ type: "hello", telegramUserId }));
  console.log("✅ Hello sent");
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => console.log(`🚀 Server running on port:${PORT}`));
