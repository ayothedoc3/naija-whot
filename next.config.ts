import type { NextConfig } from "next";

// Realtime connects over ws(s)://, not http(s)://, so the CSP needs both
// schemes for whatever Supabase URL is actually configured (works for both
// the local stack's http://127.0.0.1:54321 and a hosted https://*.supabase.co
// project without hardcoding either).
function supabaseConnectSrc(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  const wsUrl = url.replace(/^http/, "ws");
  return `${url} ${wsUrl}`;
}

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    ...(process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js dev mode (React Refresh / Turbopack HMR) requires
              // eval() to reconstruct stack traces; production never uses
              // it, so this stays out of the shipped policy.
              process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${supabaseConnectSrc()}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
