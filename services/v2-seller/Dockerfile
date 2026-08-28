# Durable deployment image for the isolated BNB Agent Studio testnet seller.
# Runtime: Node 20 + pnpm + tsx loader, Node ESM (seller.ts), no framework.
# The seller Keystore V3 stays OUTSIDE this image (mounted volume); the private
# key is never added to source, image, or the marketplace.
FROM node:20-alpine

# pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app/seller

# Install declared dependencies (frozen) + the tsx loader used to run seller.ts.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm add -D tsx

COPY tsconfig.json ./
COPY seller.ts ./

ENV NODE_ENV=production
ENV NETWORK=bsc-testnet
# ERC8183_AGENT_URL and WALLET_PASSWORD are supplied at runtime:
#   - ERC8183_AGENT_URL = the durable public HTTPS seller URL
#   - WALLET_PASSWORD   = the encrypted Keystore V3 password (secret)
# ERC8183_SERVICE_PRICE defaults to 1000000000000000000 (1 U).
ENV ERC8183_SERVICE_PRICE=1000000000000000000

# The encrypted Keystore V3 lives on a mounted volume at the SDK keystore path.
VOLUME ["/root/.bnbagent"]

EXPOSE 3000

CMD ["node", "--import", "tsx", "seller.ts"]
