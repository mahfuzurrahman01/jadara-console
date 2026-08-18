import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is browsed through an ngrok tunnel (public URL), which is a different origin than
  // localhost:3000. Next 16 blocks cross-origin requests to /_next dev resources by default,
  // which prevents the client bundle from loading (no hydration). Allow the tunnel host.
  allowedDevOrigins: ["foyer-emboss-wolf.ngrok-free.dev"],
};

export default nextConfig;
