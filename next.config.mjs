/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["exceljs"],
  // Lets a test build run alongside a running server without overwriting its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
