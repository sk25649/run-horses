import type { NextConfig } from "next";

const isPoki = process.env.NEXT_PUBLIC_POKI === '1';

const nextConfig: NextConfig = {
  ...(isPoki ? { output: 'export', distDir: 'out-poki' } : {}),
};

export default nextConfig;
