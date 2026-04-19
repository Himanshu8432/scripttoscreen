/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure the ffmpeg binary shipped by @ffmpeg-installer/ffmpeg is traced
  // into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/pipeline": ["./node_modules/@ffmpeg-installer/**/*"],
  },
  // @ffmpeg-installer/ffmpeg loads a native binary per-platform — prevent
  // Next from attempting to bundle it through webpack/turbopack.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
}

export default nextConfig
