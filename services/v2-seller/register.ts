import { EVMWalletProvider, loadEnv, ERC8004Agent, AgentEndpoint } from "@bnbagent/sdk";
import { createPublicClient, http, formatEther } from "viem";

loadEnv("C:/bnb-agent-marketplace");

if (process.env.NETWORK !== "bsc-testnet") throw new Error("NETWORK must be bsc-testnet");
if (!process.env.WALLET_PASSWORD) throw new Error("WALLET_PASSWORD missing");
if (process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY must be absent");

const wallet = new EVMWalletProvider({ password: process.env.WALLET_PASSWORD! });
const expected = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
if (wallet.address.toLowerCase() !== expected.toLowerCase()) throw new Error("ADDRESS_MISMATCH");

const agent = await ERC8004Agent.create({ walletProvider: wallet, network: "bsc-testnet" });
console.log(
  JSON.stringify({
    seller: wallet.address,
    chain: 97,
    registry: agent.contractAddress,
    agentNetwork: agent.network.name,
  })
);

const endpoint = AgentEndpoint.a2a("https://flux-management-helps-attended.trycloudflare.com", {
  capabilities: ["erc8183-negotiate"],
});
const agentUri = agent.generateAgentUri({
  name: "BNB Agent Studio v2 Testnet Seller",
  description: "BSC Testnet ERC-8183 service seller — real negotiated quote service, testnet-only",
  endpoints: [endpoint],
});

console.log(
  JSON.stringify({
    agentUriScheme: agentUri.slice(0, 30),
    payloadSummary: {
      name: "BNB Agent Studio v2 Testnet Seller",
      endpoint: endpoint.endpoint,
      chainId: 97,
    },
  })
);

const client = createPublicClient({ transport: http(agent.network.rpcUrl) });
const balanceBefore = await client.getBalance({ address: wallet.address });
console.log(JSON.stringify({ balanceTBNBBefore: formatEther(balanceBefore) }));

const result = await agent.registerAgent(agentUri);
console.log(
  JSON.stringify({
    txHash: result.transactionHash,
    agentId: result.agentId,
    blockNumber: result.receipt?.blockNumber?.toString() ?? null,
    gasUsed: result.receipt?.gasUsed?.toString() ?? null,
    status: result.receipt?.status ?? null,
  })
);

const balanceAfter = await client.getBalance({ address: wallet.address });
console.log(JSON.stringify({ balanceTBNBAfter: formatEther(balanceAfter) }));

const info = await agent.getAgentInfo(result.agentId!);
console.log(
  JSON.stringify({
    verifiedOwner: info.owner,
    verifiedAgentAddress: info.agentAddress,
    verifiedAgentId: info.agentId,
    verifiedAgentURI: info.agentURI.slice(0, 80),
  })
);
