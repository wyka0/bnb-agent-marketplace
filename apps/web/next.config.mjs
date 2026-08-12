/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@bnb-marketplace/ui",
    "@bnb-marketplace/config",
    "@bnb-marketplace/data-api",
    "@bnb-marketplace/telemetry",
    "@bnb-marketplace/integrations",
  ],
};

export default nextConfig;
