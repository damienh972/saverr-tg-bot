import express from "express";
import cors from "cors";
import { handleTransactionWebhook } from "./webhooks/notifications.js";

const app = express();
app.use(express.json());
app.use(cors());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur: http://localhost:${PORT}`);
});
