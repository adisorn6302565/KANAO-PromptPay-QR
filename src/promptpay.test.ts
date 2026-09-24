import { buildPayload, crc16, detectTarget, isValidThaiId } from './promptpay.ts';

let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n  got  ${got}\n  want ${want}`}`);
}
const crcOk = (p: string) => crc16(p.slice(0, -4)) === p.slice(-4);

eq('CRC-16/CCITT-FALSE check value', crc16('123456789'), '29B1');

const p1 = buildPayload('0801234567');
eq('static QR (11)', p1.slice(0, 16), '000201010211' + '2937');
eq('phone -> 0066 + 9 digits', p1.includes('01130066801234567'), true);
eq('no amount tag', p1.includes('5303764' + '54'), false);
eq('crc p1', crcOk(p1), true);

const p2 = buildPayload('080-123-4567', 4.22);
eq('dynamic QR (12)', p2.slice(6, 12), '010212');
eq('amount tag', p2.includes('54044.22'), true);
eq('crc p2', crcOk(p2), true);

const p3 = buildPayload('1234567890121', 1500);
eq('id tag', p3.includes('02131234567890121'), true);
eq('amount 1500.00', p3.includes('54071500.00'), true);
eq('crc p3', crcOk(p3), true);

eq('detect ewallet', detectTarget('123456789012345'), 'ewallet');
eq('detect invalid', detectTarget('12345'), null);
eq('valid id', isValidThaiId('1234567890121'), true);
eq('bad id', isValidThaiId('1234567890122'), false);
process.exit(fail ? 1 : 0);
