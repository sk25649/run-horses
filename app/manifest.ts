import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Run Horses! 3D',
    short_name: 'Run Horses',
    description: 'A 3D tactical board game. Race your horses to the Oasis.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04040e',
    theme_color: '#00ffcc',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
