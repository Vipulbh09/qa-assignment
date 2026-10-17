#!/usr/bin/env bash
# Helpers for the API steps in the bug reports. Usage:  source bugs/lib.sh
# Needs: curl, python3, and the demo running at $BASE (default http://localhost:8080).

BASE="${BASE:-http://localhost:8080}"
VISA='{"creditCardNumber":"4432-8015-6152-0454","creditCardCvv":672,"creditCardExpirationYear":2030,"creditCardExpirationMonth":1}'

# new_shopper -> prints a fresh user ID, so every report starts from an empty cart
new_shopper() { echo "str-$RANDOM$RANDOM"; }

# price PRODUCT_ID [CURRENCY] -> the price the storefront shows (units + nanos)
price() {
  curl -s "$BASE/api/products/$1?currencyCode=${2:-USD}" |
    python3 -I -c "import json,sys; print(json.load(sys.stdin)['priceUsd'])"
}

# add USER PRODUCT_ID QUANTITY [CURRENCY] -> HTTP status of POST /api/cart
add() {
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/cart" -H 'content-type: application/json' \
    -d "{\"userId\":\"$1\",\"item\":{\"productId\":\"$2\",\"quantity\":$3}}"
}

# cart USER -> the cart as the storefront returns it: "<HTTP status> <body>"
cart() { curl -s -w ' [HTTP %{http_code}]\n' "$BASE/api/cart?sessionId=$1"; }

# order USER [CARD_JSON] [CURRENCY] -> places an order; prints the response body, then "HTTP <status>"
order() {
  curl -s -m 30 -w '\nHTTP %{http_code}\n' -X POST "$BASE/api/checkout?currencyCode=${3:-USD}" \
    -H 'content-type: application/json' \
    -d "{\"userId\":\"$1\",\"userCurrency\":\"${3:-USD}\",\"email\":\"qa@example.com\",\"address\":{\"streetAddress\":\"1600 Amphitheatre Parkway\",\"city\":\"Mountain View\",\"state\":\"CA\",\"country\":\"United States\",\"zipCode\":\"94043\"},\"creditCard\":${2:-$VISA}}"
}

# currencies -> the list the storefront offers in its currency dropdown
currencies() {
  curl -s "$BASE/api/currency" |
    python3 -I -c "import json,sys; l=json.load(sys.stdin); print(len(l), 'currencies:', ' '.join(sorted(l)))"
}
