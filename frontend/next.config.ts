import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf uses canvas optionally; ignore on server
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
