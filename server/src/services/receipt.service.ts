import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { formatMoney } from '@apex/shared';
import { getSiteSettings } from './settings.service';

interface ReceiptInput {
  receiptNumber: string;
  capturedAt: Date;
  memberName: string;
  memberEmail: string;
  planName: string;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  couponCode?: string | null;
  provider: string;
  method?: string | null;
  providerPaymentId?: string | null;
  refundedMinor?: number;
}

/** Streams a PDF receipt. Contains no card details (we never receive them). */
export async function streamReceipt(res: Response, r: ReceiptInput) {
  const s = await getSiteSettings();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${r.receiptNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  // Use ASCII-safe currency label in the built-in font.
  const money = (m: number) => formatMoney(m).replace('₹', 'INR ');
  doc.fontSize(22).font('Helvetica-Bold').text(s.brand.name.toUpperCase(), { characterSpacing: 2 });
  doc.moveDown(0.2).fontSize(9).font('Helvetica').fillColor('#555');
  if (s.business.legalName) doc.text(s.business.legalName);
  doc.text([s.contact.addressLine, s.contact.city, s.contact.postalCode].filter(Boolean).join(', '));
  if (s.business.gstin) doc.text(`GSTIN: ${s.business.gstin}`);
  doc.moveDown(1.5).fillColor('#000').fontSize(16).font('Helvetica-Bold').text('Payment receipt');
  doc.moveDown(0.5).fontSize(10).font('Helvetica');
  const row = (k: string, v: string) => doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
  row('Receipt no.', r.receiptNumber);
  row('Date', r.capturedAt.toLocaleString('en-IN', { timeZone: s.business.timezone }));
  row('Billed to', `${r.memberName} <${r.memberEmail}>`);
  row('Payment method', `${r.provider}${r.method ? ` / ${r.method}` : ''}`);
  if (r.providerPaymentId) row('Payment reference', r.providerPaymentId);
  doc.moveDown(1);
  const y = doc.y;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
  doc.moveDown(0.6);
  const line = (label: string, amount: string, bold = false) => {
    const yy = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 50, yy).text(amount, 400, yy, { width: 145, align: 'right' });
    doc.moveDown(0.4);
  };
  line(`${r.planName} membership`, money(r.baseAmountMinor));
  if (r.discountMinor > 0) line(`Discount${r.couponCode ? ` (${r.couponCode})` : ''}`, `- ${money(r.discountMinor)}`);
  line('Total paid', money(r.amountMinor), true);
  if (r.refundedMinor) line('Refunded', `- ${money(r.refundedMinor)}`);
  doc.moveDown(2).fontSize(8).fillColor('#777').text('This is a computer-generated receipt. Prices are inclusive of applicable taxes unless stated otherwise.', 50);
  doc.end();
}
