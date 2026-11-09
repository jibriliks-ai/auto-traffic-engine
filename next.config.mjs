/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  compress: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },

  experimental: {
    serverComponentsExternalPackages: [
      "ffmpeg-static",
      "@remotion/bundler",
      "@remotion/renderer",
      "@remotion/cli",
      "remotion",
      "esbuild",
    ],
    outputFileTracingIncludes: {
      "/api/video/**/*": [
        "./node_modules/ffmpeg-static/ffmpeg",
        "./node_modules/ffmpeg-static/ffmpeg.exe",
      ],
    },
  },
};

export default nextConfig;

