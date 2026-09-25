import os from "node:os";
import path from "node:path";

import type { NextConfig } from "next";

function getAllowedDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "192.168.56.1",
    "192.168.29.20",
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) {
          origins.add(net.address);
        }
      }
    }
  } catch {
    // Fallback to static list if network inspection fails
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  // Allow dev assets and HMR over local network / LAN IPs
  allowedDevOrigins: getAllowedDevOrigins(),

  // Pin the workspace root. Without it Turbopack walks up the tree looking for
  // a lockfile and can pick a parent directory, which breaks path resolution.
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  // The Prisma driver adapter uses the `pg` native driver, which must run in
  // Node rather than being bundled into the server runtime.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
