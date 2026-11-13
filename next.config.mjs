import withSerwistInit from "@serwist/next";

const BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: BUILD_ID,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      const prev = config.watchOptions?.ignored;
      const base = Array.isArray(prev)
        ? prev.filter((x) => typeof x === "string" && x.length > 0)
        : typeof prev === "string" && prev.length > 0
          ? [prev]
          : ["**/node_modules/**", "**/.git/**", "**/.next/**"];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [...base, "**/.playwright-cli/**", "**/.aistudio/**"],
      };
    }
    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);

