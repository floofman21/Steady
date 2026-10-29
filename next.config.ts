import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shown on the sign-in page so it's easy to tell which deploy is live (COMMIT_REF is set by Netlify).
  env: { STEADY_VERSION: (process.env.COMMIT_REF ?? "local").slice(0, 7) },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
