/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  compress: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;