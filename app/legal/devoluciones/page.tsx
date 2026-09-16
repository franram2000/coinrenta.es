import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Desistimiento y devoluciones",
  description: "Condiciones de desistimiento, cancelación, reembolso y falta de conformidad de los servicios digitales de CoinRenta.",
};

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>;

export default function ReturnsPage() {
  return <LegalPage
    label="Desistimiento, cancelaciones y reembolsos"
    title="Devoluciones"
    intro="Esta página explica los derechos de consumidores y las condiciones aplicables al desistimiento, la cancelación de renovaciones, los reembolsos y las faltas de conformidad de las suscripciones de CoinRenta."
    updated="16 de septiembre de 2026"
    activePath="/legal/devoluciones"
    sections={[
      {
        title: "1. A quién se aplica",
        children: <P>Estas condiciones se aplican a la contratación de los planes de pago de CoinRenta por consumidores. Los usuarios que contraten con fines empresariales o profesionales pueden quedar sujetos a condiciones contractuales diferentes, dentro de los límites de la normativa aplicable.</P>,
      },
      {
        title: "2. Derecho de desistimiento de 14 días",
        children: <><P>Cuando la ley reconozca al consumidor un derecho de desistimiento en una contratación a distancia, podrá desistir del contrato sin necesidad de justificar su decisión dentro del plazo legal de <strong>14 días naturales</strong>, salvo que resulte aplicable una excepción legal.</P><P>El plazo se computará conforme a la normativa de consumidores aplicable al servicio contratado. Para ejercer el derecho basta con comunicar una decisión inequívoca de desistir antes de que finalice el plazo.</P></>,
      },
      {
        title: "3. Cómo solicitar un reembolso por desistimiento",
        children: <><P>La solicitud puede enviarse a <strong>info@coinrenta.es</strong>. Puedes utilizar el siguiente contenido o cualquier comunicación inequívoca en la que indiques tu intención de desistir:</P><div className="legal-table-wrap"><table className="legal-table"><tbody><tr><th>Solicitud</th><td>“Por la presente comunico que desisto del contrato de suscripción de CoinRenta.”</td></tr><tr><th>Datos recomendables</th><td>Nombre, correo asociado a la cuenta, plan contratado y fecha de contratación.</td></tr></tbody></table></div><P>También puedes utilizar el modelo legal de formulario de desistimiento cuando proceda. CoinRenta enviará un acuse de recibo cuando la solicitud se reciba por medios electrónicos.</P></>,
      },
      {
        title: "4. Inicio del servicio durante el plazo de desistimiento",
        children: <><P>La suscripción de CoinRenta es un servicio digital. Si solicitas que el servicio comience inmediatamente durante el plazo de desistimiento, se te informará de forma previa y expresa de las consecuencias legales que correspondan.</P><P>En los servicios cuya ejecución haya comenzado a petición expresa del consumidor durante el periodo de desistimiento, cuando la ley permita el desistimiento, podrá corresponder un importe proporcional a la parte del servicio efectivamente prestada hasta la comunicación del desistimiento.</P><P>Cuando una prestación tenga la naturaleza de contenido digital no suministrado en soporte material, el derecho de desistimiento puede quedar excluido cuando se haya iniciado la ejecución con el consentimiento previo expreso del consumidor, este haya reconocido que pierde su derecho y se haya facilitado la confirmación exigida legalmente.</P></>,
      },
      {
        title: "5. Reembolso",
        children: <P>Cuando corresponda un reembolso por desistimiento, CoinRenta lo realizará sin demoras indebidas y, en principio, dentro del plazo máximo de <strong>14 días naturales</strong> desde la comunicación del desistimiento. Se utilizará el mismo medio de pago empleado para la operación, salvo que se acuerde expresamente otro medio y siempre que no genere gastos para el consumidor. Cuando legalmente proceda descontar el importe proporcional de un servicio ya iniciado, se tendrá en cuenta la parte efectivamente prestada.</P>,
      },
      {
        title: "6. Cancelación de la renovación",
        children: <P>La cancelación de una suscripción evita renovaciones futuras, pero no equivale por sí sola al ejercicio del derecho de desistimiento ni genera automáticamente un reembolso de un periodo ya comenzado. La fecha y las condiciones de finalización serán las comunicadas en la cuenta y en la contratación, sin perjuicio de los derechos legales que correspondan.</P>,
      },
      {
        title: "7. Falta de conformidad del servicio digital",
        children: <><P>Los servicios digitales de pago deben cumplir los requisitos de conformidad establecidos legalmente y con lo que se haya contratado. Si existiera una falta de conformidad, el consumidor conservará las medidas correctoras reconocidas por la normativa, que pueden incluir la puesta en conformidad y, cuando proceda, la reducción del precio o la resolución del contrato.</P><P>Estas garantías legales son independientes del derecho de desistimiento y no pueden quedar excluidas por esta política.</P></>,
      },
      {
        title: "8. Cuándo puede no existir derecho de desistimiento",
        children: <><P>La ley contempla determinadas excepciones. Entre ellas, puede encontrarse el suministro de contenido digital sin soporte material cuando la ejecución haya comenzado cumpliendo los requisitos legales de consentimiento y conocimiento de la pérdida del derecho, así como determinados servicios completamente ejecutados bajo las condiciones previstas legalmente.</P><P>CoinRenta no aplicará una exclusión del derecho de desistimiento por el mero hecho de contratar: deberán cumplirse los requisitos legales específicos que correspondan a la naturaleza de la prestación.</P></>,
      },
      {
        title: "9. Reclamaciones",
        children: <P>Para cualquier incidencia relacionada con un cobro, cancelación, desistimiento, reembolso o falta de conformidad, puedes contactar con <strong>info@coinrenta.es</strong>. Se mantienen los derechos de reclamación extrajudicial y judicial que reconozca la normativa aplicable a consumidores.</P>,
      },
      {
        title: "10. Actualizaciones",
        children: <P>Esta política podrá actualizarse cuando cambien los servicios, el proceso de contratación o la normativa aplicable. La versión publicada en esta página será la vigente, sin perjuicio de las condiciones contractuales y derechos legales aplicables a las contrataciones realizadas con anterioridad.</P>,
      },
    ]}
  />;
}
