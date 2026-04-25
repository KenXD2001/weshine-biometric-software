const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const logger = require('../config/logger');

const tryRequireElectron = () => {
  try {
    return require('electron');
  } catch (err) {
    return null;
  }
};

const getElectronBrowserWindow = async () => {
  const electron = tryRequireElectron();
  if (!electron || !electron.app || !electron.BrowserWindow) {
    return null;
  }

  if (!electron.app.isReady()) {
    await electron.app.whenReady();
  }

  return electron.BrowserWindow;
};

const getBrowserExecutablePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  try {
    const execPath = puppeteer.executablePath && puppeteer.executablePath();
    if (execPath && fs.existsSync(execPath)) {
      return execPath;
    }
  } catch (err) {
    // ignore
  }

  if (process.versions && process.versions.electron && process.execPath && fs.existsSync(process.execPath)) {
    return process.execPath;
  }

  return undefined;
};

const getLocalImageFilePath = (imgPath) => {
  if (!imgPath) return null;
  let normalized = String(imgPath || '').trim();
  if (!normalized) return null;

  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:')) {
    return null;
  }

  if (normalized.startsWith('file://')) {
    normalized = normalized.replace(/^file:\/\//, '');
  }

  const appRoot = path.join(__dirname, '../../');

  if (normalized.startsWith('/data/')) {
    return path.join(appRoot, normalized.replace(/^\//, ''));
  }
  if (normalized.startsWith('data/')) {
    return path.join(appRoot, normalized);
  }

  if (normalized.startsWith('/uploads/')) {
    const uploadRoot = process.resourcesPath ? path.join(process.resourcesPath, 'uploads') : path.join(appRoot, 'uploads');
    return path.join(uploadRoot, normalized.replace(/^\/uploads\//, ''));
  }
  if (normalized.startsWith('uploads/')) {
    const uploadRoot = process.resourcesPath ? path.join(process.resourcesPath, 'uploads') : path.join(appRoot, 'uploads');
    return path.join(uploadRoot, normalized.replace(/^uploads\//, ''));
  }

  return null;
};

const getMimeTypeFromExtension = (extension) => {
  switch ((extension || '').toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

const getImageDataUrl = (imgPath) => {
  const filePath = getLocalImageFilePath(imgPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'png';
    const mime = getMimeTypeFromExtension(ext);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (error) {
    return null;
  }
};

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

  const dataUrl = getImageDataUrl(trimmed);
  if (dataUrl) {
    return dataUrl;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
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

const createPdfWithElectron = async (html) => {
  const BrowserWindow = await getElectronBrowserWindow();
  if (!BrowserWindow) {
    logger.debug('Electron BrowserWindow not available, skipping Electron PDF generation');
    return null;
  }

  try {
    logger.debug('Attempting PDF generation via Electron BrowserWindow.printToPDF');
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      landscape: true,
      pageSize: 'A4'
    });

    pdfWindow.close();
    logger.info('Successfully generated PDF via Electron');
    return pdfBuffer;
  } catch (error) {
    logger.warn('Electron PDF generation failed', { error: error.message });
    return null;
  }
};

const tryLaunchPuppeteer = async (options) => {
  const browsers = [];
  
  // Try custom executable path first
  if (options.executablePath) {
    browsers.push({
      path: options.executablePath,
      label: 'custom PUPPETEER_EXECUTABLE_PATH'
    });
  }

  // Add common browser paths for different OS
  if (process.platform === 'linux') {
    browsers.push(
      { path: '/usr/bin/chromium-browser', label: 'chromium-browser (Linux)' },
      { path: '/usr/bin/chromium', label: 'chromium (Linux)' },
      { path: '/snap/bin/chromium', label: 'snap chromium (Linux)' }
    );
  } else if (process.platform === 'darwin') {
    browsers.push(
      { path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', label: 'Chrome (macOS)' },
      { path: '/Applications/Chromium.app/Contents/MacOS/Chromium', label: 'Chromium (macOS)' }
    );
  } else if (process.platform === 'win32') {
    browsers.push(
      { path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', label: 'Chrome (Windows)' },
      { path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', label: 'Chrome x86 (Windows)' }
    );
  }

  let lastError = null;
  for (const browserInfo of browsers) {
    try {
      logger.debug(`Attempting to launch Puppeteer with ${browserInfo.label}`, { path: browserInfo.path });
      const browser = await puppeteer.launch({
        ...options,
        executablePath: browserInfo.path,
        timeout: 30000,
      });
      logger.info(`Successfully launched Puppeteer with ${browserInfo.label}`);
      return browser;
    } catch (error) {
      lastError = error;
      logger.debug(`Failed to launch with ${browserInfo.label}`, { error: error.message });
    }
  }

  // Try without explicit executable path
  try {
    logger.debug('Attempting to launch Puppeteer without explicit executable path');
    const browser = await puppeteer.launch({
      ...options,
      executablePath: undefined,
      timeout: 30000,
    });
    logger.info('Successfully launched Puppeteer with default executable');
    return browser;
  } catch (error) {
    lastError = error;
    logger.debug('Failed to launch Puppeteer with default executable', { error: error.message });
  }

  throw lastError || new Error('Unable to launch Puppeteer browser after all attempts');
};

const createPdfWithPuppeteer = async (html) => {
  try {
    logger.debug('Attempting PDF generation via Puppeteer');
    
    const browserOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-first-run',
        '--no-default-browser-check',
      ],
      ignoreHTTPSErrors: true,
      timeout: 60000,
    };

    const executablePath = getBrowserExecutablePath();
    if (executablePath) {
      browserOptions.executablePath = executablePath;
    }

    const browser = await tryLaunchPuppeteer(browserOptions);
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '10mm', left: '8mm', right: '8mm' }
    });

    await browser.close();
    logger.info('Successfully generated PDF via Puppeteer');
    return pdfBuffer;
  } catch (error) {
    logger.error('Puppeteer PDF generation failed', { error: error.message, stack: error.stack });
    return null;
  }
};

const createTextOnlyPdf = (candidateList) => {
  try {
    logger.debug('Falling back to text-only PDF generation via jsPDF');
    const { jsPDF } = require('jspdf');
    const { default: autoTable } = require('jspdf-autotable');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Title
    doc.setFontSize(16);
    doc.text('Biometric Candidate List', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    // Prepare table data
    const tableData = candidateList.map(c => [
      c.hallTicket || '-',
      c.candidateName || '-',
      c.emailId || '-',
      c.gender || '-',
      c.biometricStatus || '-',
      convertUtcToIST(c.imageCaptureTimestamp) || '-',
    ]);

    // Add table
    autoTable(doc, {
      head: [['Hall Ticket', 'Candidate', 'Email', 'Gender', 'Status', 'Capture Time']],
      body: tableData,
      startY: 25,
      theme: 'grid',
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
    });

    // Footer
    const pageCount = doc.internal.getPages().length;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Generated: ${getISTDateTime()} IST | Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    logger.info('Successfully generated text-only PDF via jsPDF');
    return doc.output('arraybuffer');
  } catch (error) {
    logger.error('Text-only PDF generation failed', { error: error.message });
    return null;
  }
};

const validatePdfBuffer = (buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const signature = buf.slice(0, 4).toString('ascii');
  
  if (signature !== '%PDF') {
    throw new Error(`Invalid PDF signature '${signature}'`);
  }
  if (buf.length < 256) {
    throw new Error(`PDF buffer too small (${buf.length} bytes)`);
  }
  
  return buf;
};

const generatePdfBuffer = async (html, candidateList) => {
  let pdfBuffer = null;

  // Method 1: Try Electron-native PDF generation
  try {
    pdfBuffer = await createPdfWithElectron(html);
    if (pdfBuffer) {
      return validatePdfBuffer(pdfBuffer);
    }
  } catch (error) {
    logger.warn('Electron PDF generation error', { error: error.message });
  }

  // Method 2: Try Puppeteer with multiple fallbacks
  try {
    pdfBuffer = await createPdfWithPuppeteer(html);
    if (pdfBuffer) {
      return validatePdfBuffer(pdfBuffer);
    }
  } catch (error) {
    logger.warn('Puppeteer PDF generation error', { error: error.message });
  }

  // Method 3: Fall back to text-only jsPDF
  try {
    if (candidateList && Array.isArray(candidateList)) {
      pdfBuffer = await createTextOnlyPdf(candidateList);
      if (pdfBuffer) {
        return validatePdfBuffer(Buffer.from(pdfBuffer));
      }
    }
  } catch (error) {
    logger.error('Text-only PDF fallback failed', { error: error.message });
  }

  throw new Error('All PDF generation methods failed. Unable to generate PDF.');
};

const createBiometricPdf = async (candidateList) => {
  const rowsHtml = buildCandidateTableRows(candidateList);
  const template = getTemplateHtml();
  const html = template.replace('{{rows}}', rowsHtml).replace('{{generatedAt}}', getISTDateTime());
  return generatePdfBuffer(html, candidateList);
};

module.exports = {
  createBiometricPdf,
  convertUtcToIST,
  getISTDateTime,
  resolveImageUrl,
  buildCandidateTableRows,
};