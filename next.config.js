const nextConfig = {
  reactStrictMode: true,
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-store' }, { key: 'Service-Worker-Allowed', value: '/' }] }]
  },
  webpack(config, { isServer }) {
    if (isServer) config.externals.push('node:sqlite')
    return config
  }
}

module.exports = nextConfig
