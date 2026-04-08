import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  experimental: {
    webpackMemoryOptimizations: true,
  },

  productionBrowserSourceMaps: false,

  serverExternalPackages: [
    "sharp",
    "hnswlib-node",
  ],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp: false,
        "onnxruntime-node": false,
        "hnswlib-node": false,
        undici: false,
      };

      config.module.rules.push({
        test: /\.node$/,
        use: "null-loader",
      });
    }

    if (isServer) {
      config.module.rules.push({
        test: /\.node$/,
        loader: "node-loader",
      });
    }

    return config;
  },
};

export default nextConfig;
