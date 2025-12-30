import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import {
  handleTransactionWebhook,
  handleKycWebhook,
} from "./webhooks/notifications.js";
import {
  pb,
  getUserTransactions,
  linkTelegramUser,
  getUserByPhone,
} from "./db/pocketbase.js";
import { validateInitDataRaw } from "./tmaAuth.js";

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://saverr.io/webapp",
      "https://66e444c4ed5e.ngrok-free.app",
      "https://posingly-abrogable-audry.ngrok-free.dev",
    ],
  })
);
app.use(express.json({ limit: "1mb" }));

// WebSocket hub: maps telegram_user_id to active WebSocket connections
const socketsByTelegramUserId = new Map<number, Set<WebSocket>>();

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

// Webhook endpoint for user updates (e.g., KYC status changes)
// Broadcasts KYC updates to connected WebSocket clients
app.post("/webhook/users", async (req, res) => {
  try {
    console.log("Received user webhook", req.body);
    const payload = req.body as any;
    const record = payload?.record;
    if (record?.telegram_user_id) {
      const telegramUserId = Number(record.telegram_user_id);
      wsBroadcast(telegramUserId, {
        type: "kyc_updated",
        kyc_status: record.kyc_status,
      });
    }

    await handleKycWebhook(record);
    res.json({ ok: true });
  } catch (e) {
    console.error("KYC webhook error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// API endpoint to get current authenticated user's profile
app.get("/api/me", requireTma, async (req: any, res) => {
  try {
    const telegramUserId = req.tma.user?.id;
    if (!telegramUserId) return res.json({ user: null });

    const user = await pb
      .collection("users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`)
      .catch(() => null);

    res.json({ user });
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
      .collection("users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`)
      .catch(() => null);

    if (!user) return res.json({ transactions: [] });

    const txs = await getUserTransactions(user.id).catch(() => []);
    res.json({ transactions: txs });
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
    res.json({ ok: true, transaction: record });
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
      .collection("users")
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
      message: "Transaction créée avec succès",
    });
  } catch (e) {
    console.error("Error creating transaction:", e);
    res.status(500).json({ error: "failed_to_create_transaction" });
  }
});

// Mock endpoint for development/testing: links Telegram user to phone number
// and returns a mock KYC onboarding URL
app.post("/api/onboarding", requireTma, async (req: any, res) => {
  console.log("Received /api/onboarding request", req.body);
  const telegramUserId = req.tma.user?.id;
  const phone = req.body?.phone_number;

  if (!telegramUserId || !phone) {
    return res
      .status(400)
      .json({ error: "missing telegram_user_id or phone_number" });
  }

  // Link Telegram user ID to phone number in PocketBase (dev/demo only)
  const user = await getUserByPhone(phone);
  await linkTelegramUser(user.id, telegramUserId);

  // Generate mock onboarding URL for testing
  const mockUrl = `https://mock-kyc.saverr.io/onboarding?telegram_user_id=${telegramUserId}&phone=${encodeURIComponent(
    phone
  )}`;

  console.log(`Mock onboarding URL for user ${telegramUserId}, phone ${phone}`);

  res.json({ onboardingUrl: mockUrl });
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
      .collection("users")
      .getFirstListItem(`telegram_user_id="${String(telegramUserId)}"`);

    // Update user record with wallet address and generate mock IBAN
    await pb.collection("users").update(user.id, {
      user_tw_eoa: address,
      iban: `FR76${Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase()}1234567890123`,
    });

    console.log(`Mock wallet created for user ${telegramUserId}: ${address}`);

    res.json({
      ok: true,
      iban: `FR76${Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase()}1234567890123`,
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
