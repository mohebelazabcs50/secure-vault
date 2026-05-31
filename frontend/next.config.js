/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Optimized for Docker containers
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'http://backend:5000/api/:path*'
          : 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
