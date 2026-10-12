const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack(config, { isServer }) {
    if (isServer) config.externals.push('node:sqlite')
    return config
  }
}

module.exports = nextConfig
