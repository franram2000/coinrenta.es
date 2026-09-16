import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Row = Record<string, unknown>;

function ascii(value: unknown) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[€]/g, 'EUR').replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?');
}
function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR` : '—';
}
function wrap(text: string, max = 92) {
  const words = ascii(text).split(/\s+/).filter(Boolean); const lines: string[] = []; let line = '';
  for (const word of words) { if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); }
  if (line) lines.push(line); return lines.length ? lines : [''];
}
function pdfText(content: string[]) {
  const lines = content.flatMap((line) => wrap(line));
  const maxLines = Math.min(lines.length, 88);
  const bodyLines: string[] = ['BT', '/F1 10 Tf', '50 790 Td', '12 TL'];
  for (let i = 0; i < maxLines; i++) bodyLines.push(`(${ascii(lines[i]).replace(/[()\\]/g, '\\$&')}) Tj`, 'T*');
  bodyLines.push('ET');
  const body = bodyLines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n'; const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const body = await request.json().catch(() => null) as Row | null;
  if (!body || typeof body.kind !== 'string') return NextResponse.json({ error: 'Informe no valido.' }, { status: 400 });

  const name = ascii(body.userName || user.email || 'Titular de la cuenta');
  const generated = new Date(String(body.generatedAt || Date.now()));
  const base = [
    'COINRENTA',
    'Documento de apoyo fiscal',
    `Titular: ${name}`,
    `Generado: ${generated.toLocaleString('es-ES')}`,
    '',
  ];
  let title = 'Informe'; const lines = [...base];

  if (body.kind === 'origen-fondos') {
    title = 'Trazabilidad y Origen de Fondos';
    lines.push(title, '', 'Objeto: documentar de forma estructurada la trazabilidad disponible de una retirada en EUR y sus movimientos relacionados.', '');
    const rows = Array.isArray(body.movements) ? body.movements as Row[] : [];
    for (const row of rows.slice(-35)) {
      const type = ascii(row.transactionType || row.originalType || 'movimiento'); const asset = ascii(row.baseAsset || row.quoteAsset || ''); const amount = row.baseAmount ?? row.quoteAmount ?? ''; const date = ascii(row.occurredAt || ''); const value = row.valueEur != null ? ` | valor ${money(row.valueEur)}` : '';
      lines.push(`${date} | ${type} | ${asset} ${amount}${value}`);
    }
    lines.push('', 'Nota: el informe solo afirma relaciones que pueden derivarse del historico recibido. Una entidad bancaria puede solicitar documentacion adicional.');
  } else if (body.kind === 'bolsa-perdidas') {
    title = 'Bolsa de Perdidas a Compensar'; lines.push(title, '', 'Resumen estimativo de saldos negativos derivados de transmisiones identificados en el historico, con plazo orientativo de cuatro anos.', '');
    const losses = Array.isArray(body.losses) ? body.losses as Row[] : [];
    for (const loss of losses) lines.push(`Ejercicio ${ascii(loss.year)} | pendiente ${money(loss.remaining ?? loss.loss)} | vence ${ascii(loss.expires)}`);
    if (!losses.length) lines.push('No se han identificado saldos pendientes con la informacion disponible.');
    lines.push('', 'Nota: no integra otras rentas ni circunstancias personales; debe revisarse junto con la declaracion completa.');
  } else if (body.kind === 'optimizacion-diciembre') {
    title = 'Extracto de Optimizacion de Diciembre'; lines.push(title, '', `Tipo de ahorro de referencia utilizado: ${ascii(body.taxRate)} %`, 'Se muestran posiciones con perdida latente estimada a partir de la ultima valoracion en EUR observada en el historico.', '');
    const candidates = Array.isArray(body.candidates) ? body.candidates as Row[] : [];
    for (const c of candidates) lines.push(`${ascii(c.asset)} | cantidad ${ascii(c.quantity)} | coste ${money(c.cost)} | valor ref. ${money(Number(c.lastPrice) * Number(c.quantity))} | perdida estimada ${money(c.loss)}`);
    lines.push('', 'La cifra de ahorro fiscal es una simulacion. No presupone que todas las perdidas sean compensables en la misma cuantia ni que la operacion sea conveniente.');
  } else if (body.kind === 'ganancias-no-transmisivas') {
    title = 'Desglose de Ganancias No Transmisivas'; lines.push(title, '', 'Eventos identificados como airdrop, referido, bono u otros ingresos no derivados de una transmision, con la valoracion EUR disponible.', '');
    const events = Array.isArray(body.events) ? body.events as Row[] : [];
    for (const event of events) lines.push(`${ascii(event.date)} | ${ascii(event.type)} | ${ascii(event.exchange)} | ${ascii(event.asset)} ${ascii(event.amount)} | ${money(event.valueEur)}`);
    if (!events.length) lines.push('No se han identificado eventos de este tipo.');
    lines.push('', 'Nota: la calificacion fiscal concreta depende de la naturaleza de cada percepcion y de las circunstancias del contribuyente.');
  } else return NextResponse.json({ error: 'Tipo de informe no soportado.' }, { status: 400 });

  const pdf = pdfText(lines);
  return new NextResponse(pdf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${ascii(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-coinrenta.pdf"`, 'Cache-Control': 'no-store' } });
}
