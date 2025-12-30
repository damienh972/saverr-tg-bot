#!/bin/bash

# Test script for Noah onboarding session creation
# Usage: ./examples/test-onboarding.sh

BASE_URL="http://localhost:3000"

echo "🚀 Creating Noah KYC onboarding session..."

curl -X POST "$BASE_URL/api/onboarding/create-session" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-user-123",
    "returnURL": "https://example.com/kyc-complete",
    "fiatCurrencies": ["USD", "EUR"],
    "metadata": {
      "source": "telegram_bot",
      "telegram_chat_id": "123456789"
    }
  }' | jq .

echo ""
echo "✅ Done! Check the hostedURL in the response above."
