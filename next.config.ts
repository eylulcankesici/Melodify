import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Mevcut yapılandırmalarınız korunuyor
    config.externals.push({
      '@magenta/music/es6/ddsp/add_reverb': 'commonjs @magenta/music/es6/ddsp/add_reverb'
    });
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // --- YENİ EKLENEN KURAL ---
    // Ses dosyalarını (ogg, mp3, wav) işlemek için bir kural ekliyoruz.
    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      use: [
        {
          loader: 'url-loader',
          options: {
            name: '[name]-[hash].[ext]',
            publicPath: '/_next/static/sounds/',
            outputPath: 'static/sounds/',
            limit: 1000, // 1KB'dan küçük dosyaları inline olarak ekle
          },
        },
      ],
    });
    // -------------------------

    return config;
  }
};

export default nextConfig;