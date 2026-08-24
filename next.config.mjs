/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image uploads travel as base64 inside the JSON body of /api/chat.
  // Size limits are enforced explicitly in src/lib/core/validate.ts rather
  // than by framework config, so there is nothing experimental to enable.
  async redirects() {
    // BlockCraft lives in public/minecraft/, which Next serves only at exact
    // file paths — make the bare folder URLs land on the game.
    return [
      { source: '/minecraft', destination: '/minecraft/index.html', permanent: false },
      { source: '/minecraft/', destination: '/minecraft/index.html', permanent: false },
    ];
  },
};

export default nextConfig;
