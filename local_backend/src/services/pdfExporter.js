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

  // Do NOT use the Electron executable as a Puppeteer browser — it causes
  // immediate target close errors. Only allow system Chrome/Chromium paths.
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
  if (!url) return '<span class="empty">—</span>';
  return `<img src="${url}" alt="image" style="display:block; margin:0 auto; max-width:100%; height:140px; width:auto; object-fit:contain; border-radius:0; border:1px solid rgba(148,163,184,0.22); background:#f8fafc; padding:4px;" />`;
};

const buildCandidateTableRows = (candidateList) => {
  logger.info('Building candidate table rows', { candidateCount: candidateList.length });

  const rowsHtml = candidateList.map((c, index) => {
    const signatureUrl = resolveImageUrl(c.liveImagePath);
    const photoUrl = resolveImageUrl(c.uploadedImagePath);
    const capturedWebcamUrl = resolveImageUrl(c.webcamImagePath);
    const capturedThumbUrl = resolveImageUrl(c.biometricImagePath);

    const hasSignature = !!signatureUrl;
    const hasPhoto = !!photoUrl;
    const hasCapturedWebcam = !!capturedWebcamUrl;
    const hasCapturedThumb = !!capturedThumbUrl;

    // Format timestamps for display (one per line as in original)
    const webcamTime = convertUtcToIST(c.webcamCaptureTimestamp);
    const thumbTime = convertUtcToIST(c.thumbCaptureTimestamp);
    const submitTime = convertUtcToIST(c.submitTimestamp);
    
    // Build timestamp string with line breaks
    const timestamps = [webcamTime, thumbTime, submitTime]
      .filter(t => t !== '-')
      .join('\n');

    logger.debug('Processing candidate for PDF', { 
      index, 
      applicationNumber: c.applicationNumber,
      hasSignature,
      hasPhoto,
      hasCapturedWebcam,
      hasCapturedThumb
    });

    const statusLabel = escapeHtml(c.biometricStatus || '-');
    const emailLine = escapeHtml(c.emailId || '-');

    return `
      <tr style="page-break-inside: avoid;">
        <td style="vertical-align: top; padding: 10px; font-size: 0.93rem; color: #111827; line-height: 1.4;">${escapeHtml(c.applicationNumber || '-')}</td>
        <td style="vertical-align: top; padding: 10px; font-size: 0.93rem; color: #111827; line-height: 1.4;">${escapeHtml(c.candidateName || '-')}<br/><span style="font-size:0.85rem; color:#4b5563;">${emailLine}</span></td>
        <td data-type="image" style="vertical-align: middle; padding: 10px; text-align: center; width: 150px; max-width: 180px;">${hasSignature ? imgTag(signatureUrl) : '<span class="empty" style="color:#4b5563; font-style:italic;">—</span>'}</td>
        <td data-type="image" style="vertical-align: middle; padding: 10px; text-align: center; width: 150px; max-width: 180px;">${hasPhoto ? imgTag(photoUrl) : '<span class="empty" style="color:#4b5563; font-style:italic;">—</span>'}</td>
        <td data-type="image" style="vertical-align: middle; padding: 10px; text-align: center; width: 150px; max-width: 180px;">${hasCapturedWebcam ? imgTag(capturedWebcamUrl) : '<span class="empty" style="color:#4b5563; font-style:italic;">—</span>'}</td>
        <td data-type="image" style="vertical-align: middle; padding: 10px; text-align: center; width: 150px; max-width: 180px;">${hasCapturedThumb ? imgTag(capturedThumbUrl) : '<span class="empty" style="color:#4b5563; font-style:italic;">—</span>'}</td>
        <td style="vertical-align: top; padding: 10px; font-size: 0.93rem; color: #111827; line-height: 1.4;">${statusLabel}</td>
        <td style="vertical-align: top; padding: 10px; white-space: pre-line; font-size: 0.85rem; color: #4b5563; line-height: 1.4;">${escapeHtml(timestamps) || '-'}</td>
      </tr>
    `;
  });

  return rowsHtml.join('');
};

// Helper function to escape HTML special characters
const escapeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const countMatches = (text, regex) => {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(regex) || []).length;
};

const TEMPLATE_PATH = path.join(__dirname, '../../templates/biometric-export-template.html');

const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Candidate Biometric Verification Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef4fb;
      --surface: #ffffff;
      --surface-strong: #f8fbff;
      --text: #111827;
      --muted: #4b5563;
      --border: #d1d5db;
      --accent: #2563eb;
      --accent-soft: #e0e7ff;
      --shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background: #f5f7fa;
      color: var(--text);
    }

    body {
      padding: 8px;
    }

    .container {
      max-width: 1180px;
      margin: 0 auto;
      background: var(--surface);
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .hero {
      padding: 18px 16px 14px;
      background: #f8fafc;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-title {
      max-width: 720px;
    }

    .hero-title h1 {
      margin: 0;
      font-size: 1.8rem;
      letter-spacing: -0.03em;
      line-height: 1.12;
    }

    .hero-title p {
      margin: 8px 0 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--muted);
      max-width: 100%;
    }

    .hero-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: 0;
      padding: 10px 12px;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      transition: none;
    }

    .button--primary {
      color: #ffffff;
      background: var(--accent);
      box-shadow: none;
    }

    .button--primary:hover {
      background: #1d4ed8;
    }

    .button--secondary {
      color: var(--accent);
      background: var(--accent-soft);
    }

    .hero-meta {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .meta-card {
      padding: 10px 12px;
      border-radius: 0;
      background: #ffffff;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .meta-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .meta-card span {
      display: block;
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text);
    }

    .table-wrap {
      padding: 4px 4px;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      min-width: 980px;
      border: 1px solid rgba(148, 163, 184, 0.22);
    }

    thead th {
      background: #f3f4f6;
      padding: 8px 6px;
    }

    th, td {
      padding: 10px 10px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 0.9rem;
      color: #1e3a8a;
      letter-spacing: 0.01em;
      font-weight: 700;
    }

    tbody tr:hover {
      background: transparent;
    }

    tbody tr:nth-child(odd) {
      background: #ffffff;
    }

    tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    td {
      font-size: 0.93rem;
      color: var(--text);
      line-height: 1.4;
    }

    td[data-type="image"] {
      width: 150px;
      max-width: 180px;
    }

    td[data-type="image"] img {
      width: 100%;
      height: 140px;
      object-fit: contain;
      border-radius: 0;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: #f8fafc;
      padding: 4px;
    }

    td.empty {
      color: var(--muted);
      font-style: italic;
      text-align: center;
    }

    .note {
      padding: 0 16px 16px;
      font-size: 0.9rem;
      color: var(--muted);
    }

    @media (max-width: 960px) {
      .hero {
        padding: 14px 12px 12px;
      }

      .hero-meta {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }

      td[data-type="image"] img {
        height: 120px;
      }
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }

      .container {
        box-shadow: none;
        border: none;
        border-radius: 0;
      }

      .button, .hero-actions {
        display: none;
      }

      thead th {
        background: #f8fbff;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="hero">
      <div class="hero-top">
        <div class="hero-title">
          <h1>Candidate Biometric Verification Report</h1>
          <p>Review the uploaded candidate data, image captures, and biometric status in a printable report format.</p>
        </div>
      </div>

      <div class="hero-meta">
        <div class="meta-card">
          <strong>Centre Code</strong>
          <span>{{centerCode}}</span>
        </div>
        <div class="meta-card">
          <strong>Centre Name</strong>
          <span>{{centerName}}</span>
        </div>
        <div class="meta-card">
          <strong>Exam slot</strong>
          <span>{{examSlot}}</span>
        </div>
        <div class="meta-card">
          <strong>Total candidates</strong>
          <span>{{candidateCount}}</span>
        </div>
      </div>
    </section>

    <section class="table-wrap">
      <table>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Application Number</th>
            <th>Candidate Name / Email</th>
            <th>Uploaded Signature</th>
            <th>Uploaded Photo</th>
            <th>Captured Webcam</th>
            <th>Captured Thumb</th>
            <th>Status</th>
            <th>Webcam, Thumb & Submit Timing</th>
          </tr>
        </thead>
        <tbody id="reportBody">
          {{rows}}
        </tbody>
      </table>
    </section>

    <div class="note">Generated at: {{generatedAt}} IST</div>
  </div>
</body>
</html>`;

const loadTemplateHtml = () => {
  try {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    if (!template.includes('{{rows}}')) {
      logger.warn('PDF template missing {{rows}} placeholder, falling back to built-in template', { templatePath: TEMPLATE_PATH });
      return DEFAULT_TEMPLATE_HTML;
    }
    const headerCount = countMatches(template, /<th\b/gi);
    if (headerCount !== 8) {
      logger.warn('PDF template header column count mismatch, using built-in template', { templatePath: TEMPLATE_PATH, headerCount });
      return DEFAULT_TEMPLATE_HTML;
    }
    logger.debug('Loaded PDF template from file', { templatePath: TEMPLATE_PATH, headerCount });
    return template;
  } catch (error) {
    logger.warn('Failed to load PDF template file, using built-in template', { error: error.message, templatePath: TEMPLATE_PATH });
  }
  return DEFAULT_TEMPLATE_HTML;
};

const renderTemplate = (template, values) => {
  return Object.entries(values).reduce((html, [key, value]) => {
    const replacement = key === 'rows' ? value : escapeHtml(String(value || ''));
    return html.split(`{{${key}}}`).join(replacement);
  }, template);
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

  if (options.executablePath) {
    browsers.push({ path: options.executablePath, label: 'custom PUPPETEER_EXECUTABLE_PATH' });
  }

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
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max-old-space-size=4096'
      ],
      headless: true,
      ignoreHTTPSErrors: true,
      timeout: 180000,
    };

    const executablePath = getBrowserExecutablePath();
    if (executablePath) browserOptions.executablePath = executablePath;

    const browser = await tryLaunchPuppeteer(browserOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('about:blank');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table', { timeout: 10000 });

    try {
      await page.evaluate(() => {
        document.querySelectorAll('img').forEach(img => {
          img.loading = 'eager';
          img.decoding = 'sync';
        });
      });

      const imageStats = await page.evaluate(() => {
        const images = Array.from(document.images);
        return images.map(img => ({
          src: img.currentSrc || img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          loading: img.loading,
          visible: img.offsetParent !== null
        }));
      });

      const loadedCount = imageStats.filter(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0).length;
      const errorCount = imageStats.filter(img => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)).length;
      await page.waitForFunction(() => {
        const images = Array.from(document.images);
        return images.length === 0 || images.every(img => img.complete && (img.naturalWidth > 0 || img.naturalHeight > 0));
      }, { timeout: 120000 });
    } catch (imgError) {
      logger.warn('Image loading error, proceeding with PDF generation', { error: imgError.message });
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '10mm', left: '8mm', right: '8mm' },
      timeout: 120000
    });

    await browser.close();
    logger.info('Successfully generated PDF via Puppeteer', { pdfSize: pdfBuffer.length });
    return pdfBuffer;
  } catch (error) {
    logger.error('Puppeteer PDF generation failed', { error: error.message, stack: error.stack });
    return null;
  }
};

const createTextOnlyPdf = (candidateList) => {
  try {
    logger.debug('Falling back to full PDF generation via jsPDF with images');
    const { jsPDF } = require('jspdf');
    const autoTableModule = require('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    if (typeof autoTable !== 'function') {
      throw new Error('jspdf-autotable did not export a callable function');
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Candidate Biometric Verification Report', doc.internal.pageSize.getWidth() / 2, 12, { align: 'center' });
    doc.setFontSize(9);
    doc.text('Review the uploaded candidate data, image captures, and biometric status in a printable report format.', doc.internal.pageSize.getWidth() / 2, 18, { align: 'center' });

    const tableData = candidateList.map(c => {
      const signatureUrl = resolveImageUrl(c.liveImagePath);
      const photoUrl = resolveImageUrl(c.uploadedImagePath);
      const capturedWebcamUrl = resolveImageUrl(c.webcamImagePath);
      const capturedThumbUrl = resolveImageUrl(c.biometricImagePath);
      const timestamps = [
        convertUtcToIST(c.webcamCaptureTimestamp),
        convertUtcToIST(c.thumbCaptureTimestamp),
        convertUtcToIST(c.submitTimestamp)
      ].filter(t => t !== '-').join('\n');

      return [
        c.applicationNumber || '-',
        `${c.candidateName || '-'}\n${c.emailId || '-'}`,
        signatureUrl ? '[Img]' : '-',
        photoUrl ? '[Img]' : '-',
        capturedWebcamUrl ? '[Img]' : '-',
        capturedThumbUrl ? '[Img]' : '-',
        c.biometricStatus || '-',
        timestamps || '-',
      ];
    });

    const headerColumns = 8;
    const bodyRows = tableData.length;
    const bodyColumns = bodyRows * headerColumns;
    logger.info('Text-only PDF export table dimensions', {
      headerColumns,
      bodyRows,
      bodyColumns,
      columnsPerRow: headerColumns
    });

    autoTable(doc, {
      head: [[
        'Application Number',
        'Candidate Name / Email',
        'Uploaded Signature',
        'Uploaded Photo',
        'Captured Webcam',
        'Captured Thumb',
        'Status',
        'Webcam, Thumb & Submit Timing'
      ]],
      body: tableData,
      startY: 24,
      theme: 'grid',
      margin: { top: 8, right: 8, bottom: 12, left: 8 },
      rowPageBreak: 'avoid',
      styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 6, minCellHeight: 32 },
      columnStyles: {
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'center', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 35 },
        5: { halign: 'center', cellWidth: 35 },
      },
      didDrawCell: function(data) {
        const { cell, column, row, section } = data;
        if (section === 'body' && [2, 3, 4, 5].includes(column.index)) {
          const candidate = candidateList[row.index];
          if (!candidate) return;
          let imgUrl = null;
          if (column.index === 2) imgUrl = resolveImageUrl(candidate.liveImagePath);
          if (column.index === 3) imgUrl = resolveImageUrl(candidate.uploadedImagePath);
          if (column.index === 4) imgUrl = resolveImageUrl(candidate.webcamImagePath);
          if (column.index === 5) imgUrl = resolveImageUrl(candidate.biometricImagePath);
          if (imgUrl && imgUrl.startsWith('data:')) {
            try {
              const { x, y, width, height } = cell;
              const imageHeight = Math.max(height - 2, 30);
              const imageWidth = Math.min(width - 2, 25);
              doc.addImage(imgUrl, 'JPEG', x + 1, y + 1, imageWidth, imageHeight);
              logger.debug('Added image to PDF cell', { cellHeight: height, imageHeight, imageWidth, applicationNumber: candidateList[row.index]?.applicationNumber });
            } catch (imgErr) {
              logger.debug('Could not embed image in PDF cell', { error: imgErr.message });
            }
          }
        }
      },
    });

    const pageCount = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : (doc.internal && typeof doc.internal.getNumberOfPages === 'function' ? doc.internal.getNumberOfPages() : 1);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Generated: ${getISTDateTime()} IST | Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
    }

    logger.info('Successfully generated full PDF via jsPDF with images');
    return doc.output('arraybuffer');
  } catch (error) {
    logger.error('Full PDF generation via jsPDF failed', { error: error.message });
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
  try {
    pdfBuffer = await createPdfWithElectron(html);
    if (pdfBuffer) return validatePdfBuffer(pdfBuffer);
  } catch (error) {
    logger.warn('Electron PDF generation error', { error: error.message });
  }
  try {
    pdfBuffer = await createPdfWithPuppeteer(html);
    if (pdfBuffer) return validatePdfBuffer(pdfBuffer);
  } catch (error) {
    logger.warn('Puppeteer PDF generation error', { error: error.message });
  }
  try {
    if (candidateList && Array.isArray(candidateList)) {
      pdfBuffer = await createTextOnlyPdf(candidateList);
      if (pdfBuffer) return validatePdfBuffer(Buffer.from(pdfBuffer));
    }
  } catch (error) {
    logger.error('Text-only PDF fallback failed', { error: error.message });
  }
  throw new Error('All PDF generation methods failed. Unable to generate PDF.');
};

const createBiometricPdf = async (candidateList, context = {}) => {
  logger.info('Starting PDF generation', { candidateCount: candidateList.length });
  if (!candidateList || !Array.isArray(candidateList) || candidateList.length === 0) {
    throw new Error('Invalid candidate list provided for PDF generation');
  }

  const rowsHtml = buildCandidateTableRows(candidateList);
  const bodyRowCount = countMatches(rowsHtml, /<tr\b/gi);
  const bodyColumnCount = countMatches(rowsHtml, /<td\b/gi);
  const bodyColumnsPerRow = bodyRowCount ? bodyColumnCount / bodyRowCount : 0;
  const template = loadTemplateHtml();
  const headerColumnCount = countMatches(template, /<th\b/gi);

  logger.info('PDF export table dimensions', {
    headerColumns: headerColumnCount,
    bodyRows: bodyRowCount,
    bodyColumns: bodyColumnCount,
    bodyColumnsPerRow,
    templateSource: template === DEFAULT_TEMPLATE_HTML ? 'default' : 'file',
    templatePath: TEMPLATE_PATH
  });

  if (bodyColumnsPerRow !== headerColumnCount) {
    logger.warn('PDF body columns per row do not match header columns', {
      headerColumnCount,
      bodyRows: bodyRowCount,
      bodyColumns: bodyColumnCount,
      bodyColumnsPerRow,
    });
  }

  const centerCode = candidateList[0]?.centreCode || candidateList[0]?.centreCode || context.centreCode || context.centerCode || 'N/A';
  const centerName = candidateList[0]?.centreName || candidateList[0]?.centre || context.centreName || context.centerName || 'N/A';
  const examSlot = candidateList[0]?.examSlot || candidateList[0]?.slot || context.examSlot || 'N/A';
  const candidateCount = candidateList.length;

  const html = renderTemplate(template, {
    rows: rowsHtml,
    generatedAt: getISTDateTime(),
    centerCode,
    centerName,
    examSlot,
    candidateCount
  });

  logger.info('HTML generated for PDF', { htmlLength: html.length, rowCount: candidateList.length, containsRows: html.includes('<tr') });
  return generatePdfBuffer(html, candidateList);
};

module.exports = {
  createBiometricPdf,
  convertUtcToIST,
  getISTDateTime,
  resolveImageUrl,
  buildCandidateTableRows,
};