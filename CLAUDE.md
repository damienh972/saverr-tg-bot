# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Saverr TG Bot** is a Telegram bot for managing financial transactions via the Saverr platform. It integrates with PocketBase as the backend database and provides a conversational interface for users to track and manage their transactions through Telegram.

## Core Architecture

### Three-Layer System

1. **Express Server** (`src/server.ts`)
   - Webhook endpoint receiver for PocketBase transaction updates
   - Listens on `/webhook/transactions` for transaction status changes
   - Delegates webhook handling to notification system

2. **Telegram Bot** (`src/bot/telegram.ts`)
   - Handles all user interactions via Telegram
   - Manages user authentication via phone number
   - Provides transaction management interface (view, confirm, cancel)
   - Uses long polling for receiving messages

3. **PocketBase Integration** (`src/db/pocketbase.ts`)
   - Central database interface layer
   - Collections: `users`, `transactions`, `notifications`
   - User linking via `telegram_chat_id` and `telegram_user_id`

### Data Flow

**User Onboarding:**
1. User sends `/start` command
2. Bot requests phone number via contact sharing
3. Phone number matched against PocketBase `users` collection
4. User record updated with Telegram chat ID and user ID

**Transaction Lifecycle:**
1. Transaction created in PocketBase (external system)
2. PocketBase webhook triggers `/webhook/transactions` endpoint
3. Notification handler (`src/webhooks/notifications.ts`) sends status update to user's Telegram
4. User can view details, confirm, or cancel transactions via inline keyboards

**Status Workflow:**
- `CREATED` → Initial state (not shown to users)
- `AWAITING_CONFIRMATION` → User must confirm/cancel
- `PROCESSING` → Payment instructions shown based on `funds_in` type
- `VALIDATED` / `COMPLETED` → Withdrawal instructions shown based on `funds_out` type
- `CANCELLED` / `FAILED` → Terminal states

### Key Components

**Message Templates** (`src/config/messages.ts`)
- Centralized French language messages
- Status and funds type formatters
- Webhook notification templates

**Demo Data** (`src/config/demo-data.ts`)
- Generates demo IBANs, mobile money numbers, cash addresses
- Provides contextual instructions for different fund types (BANK_WIRE, MOBILE_MONEY, CASH, CRYPTO)

## Development Commands

```bash
# Development (auto-reload on file changes)
npm run dev

# Build TypeScript
npm run build

# Production start
npm start
```

## Environment Variables

Required variables in `.env`:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
POCKETBASE_URL=http://127.0.0.1:8090
PORT=3000
NOAH_API_KEY=your_noah_api_key
NOAH_API_URL=https://api.sandbox.noah.com/v1  # or https://api.noah.com/v1 for production
```

## Database Schema Assumptions

**users collection:**
- `phone` - Phone number for matching
- `telegram_chat_id` - Telegram chat ID (set during linking)
- `telegram_user_id` - Telegram user ID (set during linking)
- `noah_virtual_iban` - Virtual IBAN for bank withdrawals
- `name` - User name (fallback display)

**transactions collection:**
- `user` - Relation to users collection
- `reference` - Human-readable transaction reference
- `amount` - Transaction amount
- `currency` - Transaction currency
- `status` - Transaction status (see workflow above)
- `funds_in` - Deposit method (BANK_WIRE, MOBILE_MONEY, CASH, CRYPTO, CARD)
- `funds_out` - Withdrawal method (same types)

## Code Conventions

- **ES Modules**: All imports use `.js` extension even for TypeScript files (required for ESM)
- **Error Handling**: Catch blocks typically send user-friendly messages; errors logged to console
- **Markdown Escaping**: Use `escapeMarkdown()` for any user data in Telegram messages with `parse_mode: "Markdown"`
- **State Management**: In-memory `Set<string>` for tracking phone number entry flow (`waitingPhone`)
- **Callback Data Prefixes**: `statusid_`, `confirm_`, `cancel_` for routing callback queries

## Important Patterns

**Callback Query Routing:**
All callback queries are handled in a single `bot.on("callback_query")` handler with prefix-based routing.

**User Verification:**
Always fetch user via `getUserByChatId()` before operations to ensure the user is linked and authorized.

**Transaction Ownership:**
Always verify `tx.user === user.id` before allowing operations on transactions.

**Dynamic Instructions:**
Transaction details show different instructions based on status and fund types - see `sendTransactionDetails()` function.

## Noah API Integration

**Noah Client** (`src/services/noah.ts`)

- HTTP client for Noah Business API
- Authentication via `X-Api-Key` header
- Base URL configurable via environment (sandbox/production)

**Onboarding Endpoint** (`POST /api/onboarding/create-session`)

- Creates a hosted KYC onboarding session via Noah API
- Returns a `hostedURL` that users can visit to complete KYC
- Request body:

  ```json
  {
    "customerId": "unique-user-id",
    "returnURL": "https://your-app.com/callback",
    "fiatCurrencies": ["USD", "EUR"],
    "metadata": { "optional": "data" }
  }
  ```

- Response: `{ "hostedURL": "https://noah-hosted-kyc-url" }`

**Integration with User Creation:**

When creating users with `kyc_status: "DRAFT"`, you can immediately generate a KYC onboarding link to send via Telegram for the user to complete their verification.
