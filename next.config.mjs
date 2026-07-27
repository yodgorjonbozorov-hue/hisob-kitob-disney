/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Ilova /app ostiga ko'chdi — eski URL'lar (bookmark va odatlar) yangi manzilga.
    const eskiYollar = [
      "/tranzaksiyalar",
      "/hisobot",
      "/byudjet",
      "/smena",
      "/sotuv",
      "/qarzlar",
      "/ombor",
      "/takroriy",
      "/bildirishnomalar",
    ];
    return [
      ...eskiYollar.map((yol) => ({
        source: yol,
        destination: `/app${yol}`,
        permanent: false,
      })),
      { source: "/admin/:path*", destination: "/app/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
