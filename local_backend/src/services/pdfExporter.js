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
  if (!url) return '-';
  return `<img src="${url}" alt="image" style="display:block; margin:0 auto; max-width:140px; min-height:120px; width:auto; height:auto; object-fit:contain;"/>`;
};

const buildCandidateTableRows = (candidateList) => {
  logger.info('Building candidate table rows', { candidateCount: candidateList.length });
  
  return candidateList.map((c, index) => {
    const signatureUrl = resolveImageUrl(c.uploadedImagePath || c.liveImagePath);
    const photoUrl = resolveImageUrl(c.liveImagePath || c.uploadedImagePath);
    const capturedPhotoUrl = resolveImageUrl(c.capturedImagePath);
    const capturedThumbUrl = resolveImageUrl(c.biometricImagePath);

    logger.debug('Processing candidate for PDF', { 
      index, 
      hallTicket: c.hallTicket,
      hasSignature: !!signatureUrl,
      hasPhoto: !!photoUrl,
      hasCapturedPhoto: !!capturedPhotoUrl,
      hasCapturedThumb: !!capturedThumbUrl
    });

    return `
      <tr style="height: 120px !important; min-height: 120px !important; page-break-inside: avoid;">
        <td class="nowrap" style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px;">${c.hallTicket || '-'}</td>
        <td style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px;">${c.candidateName || '-'}</td>
        <td style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px;">${c.emailId || '-'}</td>
        <td style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px;">${c.gender || '-'}</td>
        <td class="signature-cell" style="vertical-align: middle !important; height: 120px !important; min-height: 120px !important; text-align: center !important; padding: 4px;">${imgTag(signatureUrl)}</td>
        <td class="photo-cell" style="vertical-align: middle !important; height: 120px !important; min-height: 120px !important; text-align: center !important; padding: 4px;">${imgTag(photoUrl)}</td>
        <td class="captured-photo-cell" style="vertical-align: middle !important; height: 120px !important; min-height: 120px !important; text-align: center !important; padding: 4px;">${imgTag(capturedPhotoUrl)}</td>
        <td class="captured-thumb-cell" style="vertical-align: middle !important; height: 120px !important; min-height: 120px !important; text-align: center !important; padding: 4px;">${imgTag(capturedThumbUrl)}</td>
        <td style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px;">${c.biometricStatus || '-'}</td>
        <td class="nowrap small" style="vertical-align: top !important; height: 120px !important; min-height: 120px !important; padding: 8px; font-size: 9px;">
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
      timeout: 180000, // Further increased timeout
    };

    const executablePath = getBrowserExecutablePath();
    if (executablePath) {
      browserOptions.executablePath = executablePath;
    }

    const browser = await tryLaunchPuppeteer(browserOptions);
    const page = await browser.newPage();
    
    // Set viewport and memory optimization
    await page.setViewport({ width: 1920, height: 1080 });
    
    logger.debug('Setting HTML content', { htmlLength: html.length });
    
    // Use a more efficient way to set content for large HTML
    await page.goto('about:blank');
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    // Wait for critical elements only
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Simplified debug check
    const rowCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    logger.debug('Table rows found', { rowCount });
    
    // Wait for images with timeout
    try {
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        const imagePromises = images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const timeout = setTimeout(resolve, 5000); // 5 second timeout per image
            img.addEventListener('load', () => { clearTimeout(timeout); resolve(); });
            img.addEventListener('error', () => { clearTimeout(timeout); resolve(); });
          });
        });
        await Promise.race([
          Promise.all(imagePromises),
          new Promise(resolve => setTimeout(resolve, 10000)) // 10 second total timeout
        ]);
      });
    } catch (imgError) {
      logger.warn('Image loading timeout, proceeding with PDF generation', { error: imgError.message });
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '10mm', left: '8mm', right: '8mm' },
      timeout: 60000
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
    
    // Title
    doc.setFontSize(16);
    doc.text('Biometric Candidate List', doc.internal.pageSize.getWidth() / 2, 12, { align: 'center' });
    
    // Prepare table data with all columns matching the HTML template
    const tableData = candidateList.map(c => {
      const signatureUrl = resolveImageUrl(c.uploadedImagePath || c.liveImagePath);
      const photoUrl = resolveImageUrl(c.liveImagePath || c.uploadedImagePath);
      const capturedPhotoUrl = resolveImageUrl(c.capturedImagePath);
      const capturedThumbUrl = resolveImageUrl(c.biometricImagePath);
      
      return [
        c.hallTicket || '-',
        c.candidateName || '-',
        c.emailId || '-',
        c.gender || '-',
        signatureUrl ? '[Img]' : '-',
        photoUrl ? '[Img]' : '-',
        capturedPhotoUrl ? '[Img]' : '-',
        capturedThumbUrl ? '[Img]' : '-',
        c.biometricStatus || '-',
        (convertUtcToIST(c.imageCaptureTimestamp) || '-') + '\n' +
        (convertUtcToIST(c.thumbCaptureTimestamp) || '-') + '\n' +
        (convertUtcToIST(c.submitTimestamp) || '-'),
      ];
    });

    // Add table with all 10 columns
    autoTable(doc, {
      head: [[
        'Hall\nTicket',
        'Candidate\nName',
        'Email',
        'Gender',
        'Signature',
        'Photo',
        'Captured\nPhoto',
        'Captured\nThumb',
        'Status',
        'Image Capture / Thumb / Submit\nTimestamp'
      ]],
      body: tableData,
      startY: 20,
      theme: 'grid',
      margin: { top: 8, right: 8, bottom: 12, left: 8 },
      rowPageBreak: 'avoid',
      styles: { 
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [0, 0, 0],
        halign: 'center',
        valign: 'middle',
      },
      headStyles: { 
        fillColor: [30, 30, 30], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 6,
        minCellHeight: 32, // ~120px converted to mm (120px / 3.78 ≈ 31.7mm)
      },
      columnStyles: {
        4: { halign: 'center', cellWidth: 35 }, // Image columns with fixed width
        5: { halign: 'center', cellWidth: 35 },
        6: { halign: 'center', cellWidth: 35 },
        7: { halign: 'center', cellWidth: 35 },
      },
      didDrawCell: function(data) {
        // For image columns, attempt to embed actual images
        const { cell, column, row, section } = data;
        if (section === 'body' && [4, 5, 6, 7].includes(column.index)) {
          const candidate = candidateList[row.index];
          if (!candidate) return;
          
          let imgUrl = null;
          if (column.index === 4) imgUrl = resolveImageUrl(candidate.uploadedImagePath || candidate.liveImagePath);
          if (column.index === 5) imgUrl = resolveImageUrl(candidate.liveImagePath || candidate.uploadedImagePath);
          if (column.index === 6) imgUrl = resolveImageUrl(candidate.capturedImagePath);
          if (column.index === 7) imgUrl = resolveImageUrl(candidate.biometricImagePath);
          
          if (imgUrl && imgUrl.startsWith('data:')) {
            try {
              const { x, y, width, height } = cell;
              // Use the full cell height (should be ~32mm = 120px)
              const imageHeight = Math.max(height - 2, 30); // Ensure minimum 30mm height
              const imageWidth = Math.min(width - 2, 25); // Limit width to maintain aspect ratio
              doc.addImage(imgUrl, 'JPEG', x + 1, y + 1, imageWidth, imageHeight);
              logger.debug('Added image to PDF cell', { 
                cellHeight: height, 
                imageHeight, 
                imageWidth,
                hallTicket: candidateList[row.index]?.hallTicket 
              });
            } catch (imgErr) {
              logger.debug('Could not embed image in PDF cell', { error: imgErr.message });
            }
          }
        }
      },
    });

    // Footer with generation timestamp and page count
    const pageCount = typeof doc.getNumberOfPages === 'function'
      ? doc.getNumberOfPages()
      : (doc.internal && typeof doc.internal.getNumberOfPages === 'function'
        ? doc.internal.getNumberOfPages()
        : 1);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(
        `Generated: ${getISTDateTime()} IST | Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
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
  logger.info('Starting PDF generation', { candidateCount: candidateList.length });
  
  const rowsHtml = buildCandidateTableRows(candidateList);
  const template = getTemplateHtml();
  
  logger.debug('Template loaded', { templateLength: template.length });
  
  let html = template;
  if (!html.includes('{{rows}}')) {
    logger.warn('PDF template missing {{rows}} placeholder, falling back to raw table generation');
    html = `<!DOCTYPE html><html><head><style>table { width: 100%; border-collapse: collapse; } td, th { border: 1px solid #444; padding: 8px; } tr { height: 180px !important; min-height: 180px !important; } td { height: 180px !important; min-height: 180px !important; }</style></head><body><table><tbody>${rowsHtml}</tbody></table></body></html>`;
  } else {
    html = html.replace('{{rows}}', rowsHtml);
  }
  html = html.replace('{{generatedAt}}', getISTDateTime());
  
  logger.info('HTML generated for PDF', { 
    htmlLength: html.length,
    rowCount: candidateList.length,
    containsRows: html.includes('<tr'),
    containsStyles: html.includes('height: 180px')
  });
  
  // Debug: Log a sample of the generated HTML
  const htmlSample = html.substring(0, 1000) + '...';
  logger.debug('Generated HTML sample', { htmlSample });
  
  return generatePdfBuffer(html, candidateList);
};

module.exports = {
  createBiometricPdf,
  convertUtcToIST,
  getISTDateTime,
  resolveImageUrl,
  buildCandidateTableRows,
};