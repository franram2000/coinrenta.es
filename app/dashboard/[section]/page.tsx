import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const sections: Record<string, { title: string; description: string }> = {
  exchanges: { title: "Exchanges", description: "Conecta tus exchanges mediante API y controla el estado de cada fuente." },
  importar: { title: "Importar CSV", description: "Importa archivos de movimientos y conserva la trazabilidad de cada origen." },
  movimientos: { title: "Movimientos", description: "Consulta, filtra y revisa todos los movimientos normalizados." },
  fiscalidad: { title: "Fiscalidad", description: "Prepara el ejercicio fiscal y revisa resultados e incidencias." },
  configuracion: { title: "Configuración", description: "Gestiona tu perfil, preferencias y conexiones de CoinRenta." },
};

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  if (!sections[section]) return { title: "No encontrado", robots: { index: false, follow: false } };
  return { title: sections[section].title, description: sections[section].description, robots: { index: false, follow: false } };
}

export default async function DashboardSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = sections[section];
  if (!item) notFound();

  return (
    <main className="auth-page section-page">
      <section className="auth-card section-placeholder" aria-labelledby="section-title">
        <span className="section-kicker">CoinRenta</span>
        <h1 id="section-title">{item.title}</h1>
        <p>{item.description}</p>
        <div className="placeholder-badge">Módulo preparado</div>
        <Link className="btn btn-primary" href="/dashboard">Volver al dashboard</Link>
      </section>
    </main>
  );
}
