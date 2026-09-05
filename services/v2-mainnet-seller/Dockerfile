# Durable deployment image for the isolated BNB Agent Studio MAINNET seller.
# Runtime: Node 20 + pnpm + tsx loader, Node ESM (seller-mainnet.ts), no framework.
# The seller Keystore V3 stays OUTSIDE this image (mounted volume); the private
# key is never added to source, image, or the marketplace.
# CRITICAL: this image MUST NOT share mutable network configuration with the
# v2-seller (testnet) image. NETWORK is hard-pinned to bnb-mainnet.
FROM node:20-alpine

# pnpm
RUN corepack enable && corework prepare pnpm@9.15.9 --activate

WORKDIR /app/seller

# Install declared dependencies (frozen) + the tsx loader used to run seller-mainnet.ts.
# NOTE: package.json / pnpm-lock.yaml / tsconfig.json must be created by cloning
# from v2-seller and updating. seller-mainnet.ts and mainnet-config.ts are in this directory.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm add -D tsx

COPY tsconfig.json ./
COPY seller-mainnet.ts mainnet-config.ts ./

ENV NODE_ENV=production
ENV NETWORK=bnb-mainnet
# MAINNET_AGENT_URL and WALLET_PASSWORD are supplied at runtime:
#   - MAINNET_AGENT_URL = the durable public HTTPS seller URL (root, no path)
#   - WALLET_PASSWORD   = the encrypted Keystore V3 password (secret; must be
#     the key of the registered owner of the Mainnet agent — owner-match gate G2)
# MAINNET_HIRE_ENABLED defaults to DISABLED (absent); the seller refuses
# negotiate/fulfill unless it is explicitly "true".

# The encrypted Keystore V3 lives on a mounted volume.
# This volume MUST be a different volume/host path from the testnet seller's,
# so the two sellers can never read each other's keys.
VOLUME ["/root/.bnbagent-mainnet"]

EXPOSE 3001

CMD ["node", "--import", "tsx", "seller-mainnet.ts"]
