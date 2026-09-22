import type { NextConfig } from "next";

/**
 * A static export, because the site has nothing to do at request time: every number it shows is
 * already committed to this repository, and the page is rebuilt when a number changes rather
 * than when someone visits. That keeps decision 6 honest — Vercel holds no credentials and runs
 * no ingestion — and it means the whole site can also be served by `npx serve out` or from any
 * static host if Vercel ever stops being the answer.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
