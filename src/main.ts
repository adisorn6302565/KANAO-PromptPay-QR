import QRCode from 'qrcode';
import { buildPayload, detectTarget, isValidThaiId } from './promptpay.ts';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const targetEl = $<HTMLInputElement>('target');
const amountEl = $<HTMLInputElement>('amount');
const nameEl = $<HTMLInputElement>('name');
const rememberEl = $<HTMLInputElement>('remember');
const canvas = $<HTMLCanvasElement>('qr');
const STORE = 'kanao-promptpay';

function formatTarget(d: string): string {
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 13) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
  return d;
}

function parseAmount(): number | undefined {
  const raw = amountEl.value.replace(/[,\s฿]/g, '');
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error('จำนวนเงินไม่ถูกต้อง');
  return Math.round(n * 100) / 100;
}

function save() {
  try {
    if (rememberEl.checked) localStorage.setItem(STORE, JSON.stringify({ target: targetEl.value, name: nameEl.value }));
    else localStorage.removeItem(STORE);
  } catch { /* storage blocked */ }
}

async function render() {
  const error = $('error');
  const result = $('result');
  const hint = $('target-hint');
  error.textContent = '';
  const digits = targetEl.value.replace(/\D/g, '');
  const type = detectTarget(digits);

  hint.textContent =
    type === 'phone' ? 'เบอร์โทรศัพท์' :
    type === 'id' ? (isValidThaiId(digits) ? 'เลขบัตรประชาชน / ผู้เสียภาษี' : 'เลข 13 หลัก (checksum ไม่ตรงแบบบัตรประชาชน ตรวจเลขอีกครั้ง)') :
    type === 'ewallet' ? 'e-Wallet ID' : '';

  if (!type) {
    result.hidden = true;
    if (digits.length >= 10) error.textContent = 'ใส่เบอร์โทร 10 หลัก, เลข 13 หลัก หรือ e-Wallet 15 หลัก';
    return;
  }
  try {
    const amount = parseAmount();
    const payload = buildPayload(digits, amount);
    await QRCode.toCanvas(canvas, payload, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
    $('out-name').textContent = nameEl.value.trim();
    $('out-target').textContent = formatTarget(digits);
    $('out-amount').textContent = amount
      ? `${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
      : 'ผู้จ่ายระบุจำนวนเงินเอง';
    result.hidden = false;
    save();
  } catch (e) {
    result.hidden = true;
    error.textContent = (e as Error).message;
  }
}

function posterPng(): string {
  const scale = 2;
  const w = 360, h = 470;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b3d6b';
  g.fillRect(0, 0, w, 44);
  g.fillStyle = '#fff';
  g.font = '600 16px Sarabun, sans-serif';
  g.textAlign = 'center';
  g.fillText('Thai QR Payment · PromptPay', w / 2, 28);
  g.drawImage(canvas, 40, 60, 280, 280);
  g.fillStyle = '#111';
  g.font = '700 20px Sarabun, sans-serif';
  g.fillText($('out-name').textContent || '', w / 2, 372);
  g.font = '400 16px Sarabun, sans-serif';
  g.fillText($('out-target').textContent || '', w / 2, 398);
  g.fillStyle = '#0b3d6b';
  g.font = '700 24px Sarabun, sans-serif';
  g.fillText($('out-amount').textContent || '', w / 2, 436);
  return c.toDataURL('image/png');
}

$('dl').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = posterPng();
  a.download = `promptpay-${targetEl.value.replace(/\D/g, '')}${amountEl.value ? '-' + amountEl.value : ''}.png`;
  a.click();
});

// A link that opens this page prefilled, e.g. to send in chat
$('share').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget as HTMLButtonElement;
  const q = new URLSearchParams({ to: targetEl.value.replace(/\D/g, '') });
  if (amountEl.value) q.set('amount', amountEl.value);
  if (nameEl.value.trim()) q.set('name', nameEl.value.trim());
  const url = `${location.origin}${location.pathname}?${q}`;
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = 'คัดลอกแล้ว';
  } catch {
    btn.textContent = 'คัดลอกไม่ได้';
  }
  setTimeout(() => (btn.textContent = 'คัดลอกลิงก์'), 1500);
});
$('print').addEventListener('click', () => window.print());
$('clearAmount').addEventListener('click', () => {
  amountEl.value = '';
  render();
  amountEl.focus();
});
$('clearAll').addEventListener('click', () => {
  targetEl.value = amountEl.value = nameEl.value = '';
  history.replaceState(null, '', location.pathname); // drop ?to=&amount= so a reload stays empty
  render();
  targetEl.focus();
});
// clicking a filled field selects it, so typing replaces the old value
for (const el of [targetEl, amountEl, nameEl]) el.addEventListener('focus', () => el.select());

for (const el of [targetEl, amountEl, nameEl]) el.addEventListener('input', render);
rememberEl.addEventListener('change', save);
$('form').addEventListener('submit', (e) => e.preventDefault());

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved) {
    targetEl.value = saved.target || '';
    nameEl.value = saved.name || '';
    rememberEl.checked = true;
  }
} catch { /* ignore */ }

// ?to=0812345678&amount=100&name=... prefills (a link from "คัดลอกลิงก์")
const q = new URLSearchParams(location.search);
if (q.get('to')) targetEl.value = q.get('to')!;
if (q.get('amount')) amountEl.value = q.get('amount')!;
if (q.get('name')) nameEl.value = q.get('name')!;
render();
