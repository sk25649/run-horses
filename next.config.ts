import type { NextConfig } from "next";

const isPoki = process.env.NEXT_PUBLIC_POKI === '1';
const isCrazyGames = process.env.NEXT_PUBLIC_CRAZYGAMES === '1';
const isStaticExport = isPoki || isCrazyGames;

const nextConfig: NextConfig = {
  ...(isStaticExport ? {
    output: 'export',
    distDir: isCrazyGames ? 'out-crazygames' : 'out-poki',
  } : {}),
};

export default nextConfig;
