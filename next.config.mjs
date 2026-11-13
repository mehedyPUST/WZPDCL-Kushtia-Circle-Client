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

export default nextConfig;
