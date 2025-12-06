#!/bin/bash

# Script to test WDK Indexer API using values from .env
# Usage: ./scripts/test-indexer.sh [endpoint] [addresses]
# Examples:
#   ./scripts/test-indexer.sh health
#   ./scripts/test-indexer.sh balances "address1,address2"

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from .env file
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found in $PROJECT_ROOT"
  echo "Looking for: $ENV_FILE"
  exit 1
fi

# Load .env file, handling comments and empty lines
# This method exports variables properly
while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
    continue
  fi
  # Export the variable
  if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
    export "${BASH_REMATCH[1]}"="${BASH_REMATCH[2]}"
  fi
done < "$ENV_FILE"

# Check if required environment variables are set
if [ -z "$EXPO_PUBLIC_WDK_INDEXER_BASE_URL" ]; then
  echo "Error: EXPO_PUBLIC_WDK_INDEXER_BASE_URL not set in .env"
  exit 1
fi

if [ -z "$EXPO_PUBLIC_WDK_INDEXER_API_KEY" ]; then
  echo "Error: EXPO_PUBLIC_WDK_INDEXER_API_KEY not set in .env"
  exit 1
fi

# Set parameters
NETWORK="${1:-ethereum}"
TOKEN="${2:-usdt}"
ETHEREUM_ACCT="${3:-}"

# Base URL from .env
BASE_URL="$EXPO_PUBLIC_WDK_INDEXER_BASE_URL"
API_KEY="$EXPO_PUBLIC_WDK_INDEXER_API_KEY"

# Check if address is provided
if [ -z "$ETHEREUM_ACCT" ]; then
  echo "Error: Ethereum address required"
  echo "Usage: ./scripts/test-indexer.sh [network] [token] [address]"
  echo "Example: ./scripts/test-indexer.sh ethereum usdt 0x742d35cc6634C0532925a3b844Bc9e7595f0bEb"
  exit 1
fi

echo "Testing WDK Indexer API"
echo "======================"
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:20}..."
echo "Network: $NETWORK"
echo "Token: $TOKEN"
echo "Address: $ETHEREUM_ACCT"
echo ""

# Construct the URL
URL="$BASE_URL/api/v1/$NETWORK/$TOKEN/$ETHEREUM_ACCT/token-balances"

echo "Request URL: $URL"
echo ""

curl -X GET "$URL" \
     -H "x-api-key: $API_KEY" \
     -H "Content-Type: application/json" \
     -v \
     -w "\n\nHTTP Status: %{http_code}\n" \
     2>&1 | tee /tmp/indexer-response.log

echo ""
echo "Response saved to /tmp/indexer-response.log"