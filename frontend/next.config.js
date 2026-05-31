/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',          // Enable static export for serverless GitHub Pages hosting
  trailingSlash: true,       // Generates folders with index.html files for deep routing
  images: {
    unoptimized: true,       // Required for static HTML export
  },
  basePath: '/secure-vault', // Required for GitHub Pages since repo path is /secure-vault
};

module.exports = nextConfig;
