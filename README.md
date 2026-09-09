# CoinRenta

Landing y aplicación web de CoinRenta, preparada para desplegarse en Vercel con Next.js.

## Stack

- Next.js 16.3.3
- React 19.2
- TypeScript
- CSS global sin framework
- Supabase para la capa de datos de la aplicación

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Producción

```bash
npm install
npm run build
npm start
```

Vercel detecta automáticamente Next.js al importar este repositorio. No hace falta definir un comando de salida personalizado.

## Estructura inicial

- `app/page.tsx`: landing page.
- `app/globals.css`: sistema visual global y responsive.
- `app/layout.tsx`: metadata SEO y configuración global.
- `app/robots.ts`: robots.txt generado por Next.js.
- `app/sitemap.ts`: sitemap.xml generado por Next.js.
- `public/favicon.svg`: identidad básica de CoinRenta.
