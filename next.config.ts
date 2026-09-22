import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
