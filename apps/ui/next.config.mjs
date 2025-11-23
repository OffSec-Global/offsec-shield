/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
  eslint: {
    dirs: ['src']
  }
};

module.exports = nextConfig;
