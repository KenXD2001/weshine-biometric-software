const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const getISTDateTime = () => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffsetMillis = 5.5 * 60 * 60000;
  const istTime = new Date(utcMillis + istOffsetMillis);

  const yyyy = istTime.getFullYear();
  const mm = String(istTime.getMonth() + 1).padStart(2, '0');
  const dd = String(istTime.getDate()).padStart(2, '0');
  const hh = String(istTime.getHours()).padStart(2, '0');
  const min = String(istTime.getMinutes()).padStart(2, '0');
  const ss = String(istTime.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const convertUtcToIST = (utcTimestamp) => {
  if (!utcTimestamp) return '-';
  const date = new Date(utcTimestamp);
  if (Number.isNaN(date.getTime())) return utcTimestamp;

  const utcMillis = date.getTime();
  const istOffsetMillis = 5.5 * 60 * 60000;
  const istDate = new Date(utcMillis + istOffsetMillis);

  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const hh = String(istDate.getHours()).padStart(2, '0');
  const min = String(istDate.getMinutes()).padStart(2, '0');
  const ss = String(istDate.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const resolveImageUrl = (imgPath) => {
  if (!imgPath) return '';
  const trimmed = String(imgPath || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const host = process.env.EXPORT_PDF_HOST || `http://127.0.0.1:${process.env.PORT || 8080}`;
  if (trimmed.startsWith('/')) return `${host}${trimmed}`;
  return `${host}/${trimmed}`;
};

const imgTag = (url) => {
  if (!url) return '-';
  return `<img src="${url}" alt="image" style="max-width:80px; max-height:60px; object-fit:contain;"/>`;
};

const buildCandidateTableRows = (candidateList) => {
  return candidateList.map(c => {
    const signatureUrl = resolveImageUrl(c.uploadedImagePath || c.liveImagePath);
    const photoUrl = resolveImageUrl(c.liveImagePath || c.uploadedImagePath);
    const capturedPhotoUrl = resolveImageUrl(c.capturedImagePath);
    const capturedThumbUrl = resolveImageUrl(c.biometricImagePath);

    return `
      <tr>
        <td class="nowrap">${c.hallTicket || '-'}</td>
        <td>${c.candidateName || '-'}</td>
        <td>${c.emailId || '-'}</td>
        <td>${c.gender || '-'}</td>
        <td>${imgTag(signatureUrl)}</td>
        <td>${imgTag(photoUrl)}</td>
        <td>${imgTag(capturedPhotoUrl)}</td>
        <td>${imgTag(capturedThumbUrl)}</td>
        <td>${c.biometricStatus || '-'}</td>
        <td class="nowrap small">
          ${convertUtcToIST(c.imageCaptureTimestamp)}<br/>
          ${convertUtcToIST(c.thumbCaptureTimestamp)}<br/>
          ${convertUtcToIST(c.submitTimestamp)}
        </td>
      </tr>
    `;
  }).join('');
};

const getTemplateHtml = () => {
  const templatePath = path.join(__dirname, '../../templates/biometric-export-template.html');
  return fs.readFileSync(templatePath, 'utf8');
};

const generatePdfBuffer = async (html) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '12mm', bottom: '10mm', left: '8mm', right: '8mm' }
  });

  await browser.close();

  const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const signature = buffer.slice(0, 4).toString('ascii');
  if (signature !== '%PDF') {
    throw new Error(`Invalid PDF signature '${signature}'`);
  }
  if (buffer.length < 256) {
    throw new Error(`PDF buffer too small (${buffer.length})`);
  }

  return buffer;
};

const createBiometricPdf = async (candidateList) => {
  const rowsHtml = buildCandidateTableRows(candidateList);
  const template = getTemplateHtml();
  const html = template.replace('{{rows}}', rowsHtml).replace('{{generatedAt}}', getISTDateTime());
  return generatePdfBuffer(html);
};

module.exports = {
  createBiometricPdf,
  convertUtcToIST,
  getISTDateTime,
  resolveImageUrl,
  buildCandidateTableRows,
};