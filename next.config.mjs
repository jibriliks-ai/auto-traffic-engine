/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  compress: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },

  experimental: {
    // Don't bundle ffmpeg-static — its index.js resolves the binary path at
    // build time via __dirname, which Next.js rewrites into a non-existent
    // .next/server/... path. Keeping it external lets require() find it at
    // runtime in node_modules (that's the ENOENT fix).
    serverComponentsExternalPackages: ["ffmpeg-static"],

    // Belt-and-suspenders: force the binary into the traced output so it
    // survives even if the deploy ever switches to `output: "standalone"`.
    outputFileTracingIncludes: {
      "/api/video/**/*": [
        "./node_modules/ffmpeg-static/ffmpeg",
        "./node_modules/ffmpeg-static/ffmpeg.exe",
      ],
    },
  },
};

export default nextConfig;