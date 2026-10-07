/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  async rewrites() {
    if (process.env.CLOUDFLARE_BUILD === "1") return [];
    return [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://127.0.0.1:8787"}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : ""} https://challenges.cloudflare.com https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com; frame-src https://challenges.cloudflare.com https://accounts.google.com https://docs.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
