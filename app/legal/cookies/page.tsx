import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Información sobre las cookies y tecnologías similares utilizadas por CoinRenta.",
};

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

export default function CookiesPage() {
  return (
    <LegalPage
      label="Cookies y tecnologías similares"
      title="Política de cookies"
      intro="Te explicamos qué cookies utiliza CoinRenta, para qué sirven, cuándo están exentas de consentimiento y cómo gestionar tus preferencias."
      updated="14 de septiembre de 2026"
      sections={[
        {
          title: "1. Qué son las cookies",
          children: <P>Las cookies y tecnologías similares son pequeños identificadores que pueden almacenarse en el dispositivo para permitir, entre otras funciones, mantener una sesión, recordar determinadas preferencias o analizar el uso de un servicio. Pueden implicar tratamiento de datos personales en función de su configuración y finalidad.</P>,
        },
        {
          title: "2. Cookies utilizadas actualmente",
          children: <>
            <P>CoinRenta utiliza únicamente las tecnologías necesarias para prestar y proteger las funciones básicas del sitio y de la cuenta, incluyendo la autenticación y el mantenimiento de la sesión. Estas tecnologías se consideran, cuando cumplen los requisitos legales, <strong>estrictamente necesarias</strong> y no requieren consentimiento previo.</P>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th>Finalidad</th><th>Tipo</th><th>Necesaria</th></tr></thead>
                <tbody>
                  <tr><td>Autenticación y mantenimiento de sesión</td><td>Técnica / propia o del proveedor de autenticación</td><td>Sí</td></tr>
                  <tr><td>Seguridad y prevención de usos indebidos</td><td>Técnica</td><td>Sí</td></tr>
                  <tr><td>Preferencias imprescindibles del servicio</td><td>Técnica</td><td>Sí, cuando exista</td></tr>
                </tbody>
              </table>
            </div>
            <P>No utilizamos actualmente cookies publicitarias ni cookies destinadas a elaborar perfiles publicitarios.</P>
          </>,
        },
        {
          title: "3. Tecnologías de terceros",
          children: <P>Algunos servicios técnicos utilizados por CoinRenta, como infraestructura, alojamiento o autenticación, pueden establecer identificadores estrictamente necesarios para prestar sus funciones. Estos identificadores no deben utilizarse para fines distintos de los informados sin cumplir las obligaciones de información y consentimiento que correspondan.</P>,
        },
        {
          title: "4. Cookies que requieren consentimiento",
          children: <P>Si en el futuro incorporamos cookies analíticas, publicitarias, de personalización no estrictamente necesaria u otras tecnologías que requieran consentimiento, se bloquearán antes de su instalación o lectura cuando la ley así lo exija y se mostrará un mecanismo que permita aceptar, rechazar o configurar las categorías de cookies. Aceptar y rechazar se presentarán con un nivel de visibilidad equivalente.</P>,
        },
        {
          title: "5. Cómo gestionar las cookies",
          children: <P>Las cookies técnicas imprescindibles no pueden desactivarse sin afectar al funcionamiento del servicio. Para las categorías que requieran consentimiento, CoinRenta proporcionará un mecanismo accesible para modificar o retirar la decisión. También puedes gestionar cookies desde la configuración de tu navegador, aunque bloquear cookies necesarias puede impedir el acceso o el funcionamiento de determinadas funciones.</P>,
        },
        {
          title: "6. Actualización del consentimiento",
          children: <P>Cuando exista un mecanismo de consentimiento para cookies no necesarias, conservaremos la elección durante el periodo permitido y ofreceremos una vía sencilla para modificarla. Las preferencias se volverán a solicitar cuando sea necesario conforme a la normativa y a los cambios relevantes en las tecnologías utilizadas.</P>,
        },
        {
          title: "7. Más información",
          children: <P>Para conocer el tratamiento general de datos personales, consulta la <a href="/legal/privacidad">Política de privacidad</a>. Para dudas sobre cookies: <strong>info@coinrenta.es</strong>.</P>,
        },
      ]}
    />
  );
}
