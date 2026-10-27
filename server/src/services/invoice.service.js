import PDFDocument from 'pdfkit';
import env from '../config/env.js';
import { Payment } from '../models/index.js';
import { getPublishedSettings } from './settings.service.js';
import { ApiError } from '../utils/ApiError.js';

const PERIOD_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-yearly', yearly: 'Yearly' };
// PDFKit's built-in fonts have no ₹ glyph, so amounts are printed as "INR".
const money = (p) => `INR ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: env.GYM_TIMEZONE }) : '-');

export async function renderInvoice(paymentId) {
  const payment = await Payment.findById(paymentId).populate('user', 'name email phone').populate('plan', 'name').populate('membership', 'startDate endDate').populate('coupon', 'code');
  if (!payment || !payment.invoiceNumber) throw ApiError.notFound('Invoice not available for this payment');
  const s = await getPublishedSettings();

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Invoice ${payment.invoiceNumber}`, Author: s.brand.name } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const gold = '#A07C28';
  doc.rect(0, 0, doc.page.width, 8).fill(gold);
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(20).text(s.brand.name, 50, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#555')
    .text(s.contact.address).text(s.contact.city).text(`${s.contact.phone} · ${s.contact.email}`);
  if (env.INVOICE_GSTIN) doc.text(`GSTIN: ${env.INVOICE_GSTIN}`);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(gold).text(payment.status === 'refunded' ? 'INVOICE (REFUNDED)' : 'TAX INVOICE', 350, 50, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`Invoice no: ${payment.invoiceNumber}`, 350, 75, { align: 'right' })
    .text(`Date: ${fmtDate(payment.paidAt)}`, { align: 'right' })
    .text(`Payment: ${payment.method === 'razorpay' ? 'Online (Razorpay)' : payment.method.replace('_', ' ')}`, { align: 'right' });
  if (payment.razorpayPaymentId) doc.text(`Ref: ${payment.razorpayPaymentId}`, { align: 'right' });

  doc.moveDown(3).font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Billed to', 50);
  doc.font('Helvetica').fontSize(10).text(payment.user?.name || 'Member').text(payment.user?.email || '');
  if (payment.user?.phone) doc.text(payment.user.phone);

  const top = doc.y + 25;
  doc.rect(50, top, 495, 22).fill('#F3EEE2');
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(9).text('Description', 60, top + 7).text('Amount', 440, top + 7, { width: 95, align: 'right' });
  let y = top + 32;
  const row = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111').text(label, 60, y, { width: 360 }).text(value, 440, y, { width: 95, align: 'right' });
    y += 20;
  };
  const period = payment.membership ? ` (${fmtDate(payment.membership.startDate)} – ${fmtDate(payment.membership.endDate)})` : '';
  row(`${payment.plan?.name || 'Membership'} membership — ${PERIOD_LABEL[payment.period] || ''}${period}`, money(payment.basePaise));
  if (payment.joiningFeePaise) row('One-time joining fee', money(payment.joiningFeePaise));
  if (payment.discountPaise) row(`Discount${payment.coupon?.code ? ` (${payment.coupon.code})` : ''}`, `- ${money(payment.discountPaise)}`);
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
  y += 10;
  row('Total paid', money(payment.amountPaise), true);
  if (payment.status === 'refunded' && payment.refund?.amountPaise) row('Refunded', `- ${money(payment.refund.amountPaise)}`);

  doc.font('Helvetica').fontSize(8).fillColor('#777')
    .text('Prices are inclusive of applicable taxes. This is a computer-generated invoice and does not require a signature.', 50, 760, { width: 495, align: 'center' });
  doc.end();
  return done;
}
