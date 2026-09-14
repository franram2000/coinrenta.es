import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso y contratación de los servicios de CoinRenta.",
};

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>;

export default function TermsPage() {
  return (
    <LegalPage
      label="Condiciones de uso"
      title="Términos y condiciones"
      intro="Estas condiciones regulan el acceso y, cuando proceda, la contratación de los servicios digitales de CoinRenta."
      updated="14 de septiembre de 2026"
      sections={[
        {
          title: "1. Identificación y aceptación",
          children: <P>CoinRenta es un servicio digital accesible desde coinrenta.es. El uso del sitio requiere respetar el Aviso legal y la Política de privacidad. Cuando exista contratación de un plan de pago, también serán aplicables las condiciones económicas mostradas antes de confirmar el pedido.</P>,
        },
        {
          title: "2. Servicio ofrecido",
          children: <P>CoinRenta proporciona herramientas para importar, organizar, conciliar y analizar información sobre activos digitales, así como para preparar información de apoyo relacionada con obligaciones fiscales. El alcance concreto de cada plan será el indicado en la web en el momento de la contratación.</P>,
        },
        {
          title: "3. Cuenta de usuario",
          children: <UL><li>Debes proporcionar información veraz y mantenerla actualizada.</li><li>Debes proteger las credenciales de acceso y comunicar cualquier acceso no autorizado.</li><li>No puedes compartir una cuenta cuando el plan contratado sea personal, ni utilizarla para acceder a datos de otros usuarios.</li><li>Eres responsable de revisar la información importada y de mantener copias razonables de los datos que necesites conservar.</li></UL>,
        },
        {
          title: "4. Conexiones con exchanges y fuentes externas",
          children: <>
            <P>Cuando conectes un exchange o importes un CSV, autorizas a CoinRenta a tratar la información necesaria para prestar la función solicitada. Siempre que el proveedor lo permita, deben utilizarse claves API con permisos mínimos y exclusivamente de lectura.</P>
            <P><strong>Nunca debes utilizar una clave API con permisos de retirada, transferencia o movimiento de fondos si no es estrictamente necesaria para una función expresamente descrita y autorizada.</strong></P>
            <P>CoinRenta no custodia tus criptoactivos ni puede realizar retiradas de fondos por el mero hecho de conectar una API de consulta.</P>
          </>,
        },
        {
          title: "5. Información fiscal",
          children: <P>CoinRenta no sustituye a un asesor fiscal, contable o jurídico. Las herramientas pueden ayudarte a organizar información y realizar cálculos, pero los resultados deben revisarse antes de utilizarlos en una autoliquidación o declaración. Las obligaciones fiscales dependen de la situación concreta de cada persona y de la normativa vigente.</P>,
        },
        {
          title: "6. Planes de pago y contratación",
          children: <>
            <P>Cuando exista un plan de pago, antes de contratar se mostrarán de forma clara el precio, impuestos aplicables cuando proceda, características principales, duración, renovación y medios de pago disponibles.</P>
            <P>La contratación se entenderá perfeccionada cuando el proceso de compra haya sido completado y el pedido confirmado. Se facilitará al consumidor la confirmación de la contratación en un soporte duradero cuando la normativa lo exija.</P>
          </>,
        },
        {
          title: "7. Renovación y cancelación",
          children: <P>Si un plan se renueva automáticamente, esta circunstancia y su periodicidad deberán mostrarse antes de la contratación. El usuario podrá cancelar la renovación para evitar cargos futuros mediante el mecanismo habilitado en su cuenta o contactando con soporte. La cancelación de una renovación no implica necesariamente la devolución de periodos ya iniciados, salvo que corresponda conforme a la ley o a las condiciones particulares contratadas.</P>,
        },
        {
          title: "8. Derecho de desistimiento de consumidores",
          children: <>
            <P>Cuando una persona tenga la condición legal de consumidora y contrate a distancia, podrá disponer del derecho de desistimiento en los términos previstos por la normativa de consumidores, salvo que resulte aplicable una excepción legal.</P>
            <P>En el caso de servicios o contenidos digitales cuya ejecución comience durante el plazo de desistimiento, cualquier solicitud de inicio inmediato y cualquier pérdida del derecho de desistimiento se formalizarán únicamente cuando se cumplan los requisitos legales de información, consentimiento previo y confirmación.</P>
            <P>Cuando proceda el desistimiento, se facilitará un procedimiento claro para ejercerlo y se respetarán los plazos y reembolsos establecidos legalmente.</P>
          </>,
        },
        {
          title: "9. Datos del usuario y portabilidad del contenido",
          children: <P>Los datos que aportes a CoinRenta siguen correspondiendo al usuario en la medida prevista por la ley. Cuando resulte legalmente aplicable, podrás solicitar acceso o recuperación de determinados contenidos digitales aportados o generados mediante el servicio. La Política de privacidad regula el tratamiento de datos personales.</P>,
        },
        {
          title: "10. Disponibilidad y mantenimiento",
          children: <P>CoinRenta podrá realizar actualizaciones, mantenimiento y cambios técnicos necesarios para la seguridad o evolución del servicio. Procuraremos minimizar las interrupciones, pero no garantizamos una disponibilidad ininterrumpida cuando dependamos de redes, proveedores de alojamiento, autenticación, exchanges u otros servicios externos.</P>,
        },
        {
          title: "11. Uso prohibido",
          children: <UL><li>Usar el servicio para actividades ilícitas o fraudulentas.</li><li>Intentar acceder a cuentas, datos o sistemas ajenos.</li><li>Introducir malware, automatizaciones abusivas o tráfico destinado a degradar el servicio.</li><li>Utilizar CoinRenta para prestar a terceros servicios regulados sin las autorizaciones que correspondan.</li><li>Vulnerar derechos de propiedad intelectual o las condiciones de terceros integrados.</li></UL>,
        },
        {
          title: "12. Propiedad intelectual",
          children: <P>Los elementos del servicio pertenecen a CoinRenta o a sus licenciantes y están protegidos por la legislación aplicable. Se concede únicamente el derecho de uso necesario para utilizar el servicio de acuerdo con estas condiciones.</P>,
        },
        {
          title: "13. Responsabilidad",
          children: <P>Dentro de los límites legalmente permitidos, no garantizamos que los datos externos, precios de mercado, archivos importados o información fiscal estén siempre completos o libres de errores. Ninguna cláusula de estas condiciones limita derechos irrenunciables de consumidores ni responsabilidades que legalmente no puedan excluirse.</P>,
        },
        {
          title: "14. Suspensión o terminación",
          children: <P>Podremos suspender temporalmente el acceso cuando sea necesario para proteger el servicio, investigar abusos o cumplir una obligación legal. En caso de incumplimiento grave de estas condiciones, podrá resolverse la relación conforme a la normativa aplicable y a las condiciones contratadas.</P>,
        },
        {
          title: "15. Reclamaciones y contacto",
          children: <P>Para incidencias, consultas o reclamaciones: <strong>info@coinrenta.es</strong>. Si eres consumidor, conservarás los mecanismos de reclamación extrajudicial y judicial que te reconozca la normativa aplicable.</P>,
        },
        {
          title: "16. Legislación aplicable",
          children: <P>Estas condiciones se regirán por la legislación española y de la Unión Europea que resulte aplicable. Cuando la persona usuaria sea consumidora, serán de aplicación las normas imperativas de protección que correspondan.</P>,
        },
      ]}
    />
  );
}
