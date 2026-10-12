const nextConfig = {
  reactStrictMode: true,
  experimental: { cpus: 2 },
  webpack(config, { isServer }) {
    if (isServer) config.externals.push('node:sqlite')
    return config
  }
}

module.exports = nextConfig
