import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TV Games',
    short_name: 'TV Games',
    description: 'Play iconic board games and challenges from hit TV shows.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04040e',
    theme_color: '#04040e',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
