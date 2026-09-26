import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1", "100.108.100.25", "192.168.1.133"],
};

export default nextConfig;
