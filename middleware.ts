import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Map subdomains to internal route paths
const SUBDOMAIN_ROUTES: Record<string, string> = {
  runhorses: '/run-horses',
  // Add future games here:
  // newgame: '/new-game',
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const url = req.nextUrl.clone();

  // Extract subdomain: "runhorses.tvgames.dev" → "runhorses"
  // Also handle "runhorses.lvh.me:3000" for local dev
  const parts = host.split('.');

  // Need at least a subdomain + domain (e.g., runhorses.tvgames.dev or runhorses.lvh.me)
  // Skip localhost, plain IPs, and the bare domain
  if (parts.length >= 2) {
    const subdomain = parts[0].toLowerCase();

    // Skip www subdomain
    if (subdomain === 'www') return NextResponse.next();

    const routePath = SUBDOMAIN_ROUTES[subdomain];
    if (routePath) {
      // Rewrite: keep the browser URL as-is, serve from the internal route
      url.pathname = `${routePath}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.svg$).*)'],
};
