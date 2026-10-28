/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT use output: "standalone" on Vercel — it can break the serverless build.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
