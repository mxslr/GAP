/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['groq-sdk', '@google/generative-ai', 'undici'],
  },
}

module.exports = nextConfig
