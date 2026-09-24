import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone (server.js + traced deps) for the Docker image.
  output: "standalone",
};

export default nextConfig;
