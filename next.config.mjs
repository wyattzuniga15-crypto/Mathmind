/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image uploads travel as base64 inside the JSON body of /api/chat.
  // Size limits are enforced explicitly in src/lib/core/validate.ts rather
  // than by framework config, so there is nothing experimental to enable.
};

export default nextConfig;
