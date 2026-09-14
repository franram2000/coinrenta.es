import type { MetadataRoute } from "next";

const siteUrl = "https://coinrenta.es";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/legal/aviso-legal`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/legal/privacidad`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/legal/cookies`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/legal/terminos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
  ];
}
