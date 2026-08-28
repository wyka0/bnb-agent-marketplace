# BNB Agent Studio v2 Testnet Seller

Isolated ERC-8183 commercial seller service (BSC Testnet, chain 97). This is a
standalone Node ESM service — it is intentionally NOT part of the marketplace
web app. The seller wallet stays here and never leaves this service.

## Public routes

- `GET /health` — `{ status: "ok", chain: 97, seller: <address> }` (safe public data only)
- `GET /.well-known/agent-card.json` — EIP-8004 agent card; the A2A endpoint is built from `ERC8183_AGENT_URL`
- `POST /negotiate` — verified commercial quote (`accepted`, `price`, `chain_id`, `verifying_contract`, `negotiation_hash`, `provider_sig`)
- everything else → `404`

No filesystem access, no directory traversal, no arbitrary proxy, no generic
RPC forwarding, no environment endpoint, no signing endpoint, no debug
endpoint, no private-key endpoint.

## Required environment

| Variable                | Meaning                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `NETWORK`               | must be `bsc-testnet`                                               |
| `WALLET_PASSWORD`       | password of the encrypted Keystore V3 (SECRET — never commit/print) |
| `ERC8183_AGENT_URL`     | durable public HTTPS URL of this deployed seller                    |
| `ERC8183_SERVICE_PRICE` | default `1000000000000000000` (1 U)                                 |

`PRIVATE_KEY` is only needed on first-run Keystore V3 creation and must NOT be
present afterwards. The deployed seller loads the encrypted Keystore V3 from
the SDK keystore path (mounted volume).

## Deployment

Build and run:

```sh
docker build -t bnb-seller services/v2-seller
docker run --rm -p 3000:3000 \
  -e NETWORK=bsc-testnet \
  -e WALLET_PASSWORD=<secret> \
  -e ERC8183_AGENT_URL=https://<durable-host> \
  -v /secure/path/.bnbagent:/root/.bnbagent \
  bnb-seller
```

Mount the encrypted Keystore V3 into the image (never baked in). After
deployment verify read-only:

- `GET /health` → 200, `chain: 97`
- `GET /.well-known/agent-card.json` → 200, endpoint == `ERC8183_AGENT_URL`
- `POST /negotiate` → 200, valid `provider_sig` (verify with `verifyQuoteSignature`)

No blockchain transaction is required to run this service or verify it.
