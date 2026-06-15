/** @type {import('next').NextConfig} */
// Static export so the app deploys to GitHub Pages with no server — matching the
// architecture of the Coach Claudio (training-ai) and NutriPrep apps.
// For a project page served at /<repo>, set NEXT_PUBLIC_BASE_PATH=/<repo> (the
// deploy workflow does this). For a root/custom-domain deploy, leave it unset.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
