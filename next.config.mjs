import withSerwistInit from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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

