/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    // Allow production builds even if there are type errors
    ignoreBuildErrors: true,
  },
  // React Compiler (optional – enable only if you install babel-plugin-react-compiler)
  // experimental: {
  //   reactCompiler: true,
  // },
};

export default nextConfig;
