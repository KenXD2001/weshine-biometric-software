const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const log = require('electron-log');
const Store = require('electron-store');

// Load environment variables from .env files
try {
  // Try to load from backend .env file
  const backendEnvPath = isDev 
    ? path.join(__dirname, '..', 'local_backend', '.env')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'local_backend', '.env');
  
  if (require('fs').existsSync(backendEnvPath)) {
    require('dotenv').config({ path: backendEnvPath });
    log.info('Loaded backend environment variables from:', backendEnvPath);
  }
} catch (err) {
  log.warn('Could not load backend .env file:', err.message);
}

// Initialize electron store for settings
const store = new Store();

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;

// Get configuration from environment variables or use defaults
const BACKEND_PORT = process.env.PORT || 8080;
const BACKEND_HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3030;
const CLOUD_BACKEND_URL = process.env.CLOUD_BACKEND_URL || 'http://localhost:8040';

// Log configuration information
log.info('=== APPLICATION CONFIGURATION ===');
log.info('Backend Configuration:');
log.info(`  - Host: ${BACKEND_HOST}`);
log.info(`  - Port: ${BACKEND_PORT}`);
log.info(`  - Full URL: http://${BACKEND_HOST}:${BACKEND_PORT}`);
log.info('Frontend Configuration:');
log.info(`  - Port: ${FRONTEND_PORT}`);
log.info(`  - Full URL: http://localhost:${FRONTEND_PORT}`);
log.info('Cloud Backend Configuration:');
log.info(`  - URL: ${CLOUD_BACKEND_URL}`);
log.info('================================');

/**
 * Create the main application window
 */
function createWindow() {
  log.info('Creating main window');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Digi Biometric System',
    icon: path.join(__dirname, 'resources', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev // Enable DevTools only in development
    },
    show: false, // Don't show until ready
    backgroundColor: '#ffffff',
    autoHideMenuBar: !isDev, // Hide menu in production
  });

  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    log.info('Main window shown');
  });

  // Load the frontend
  const frontendURL = isDev 
    ? `http://localhost:${FRONTEND_PORT}` 
    : `http://localhost:${FRONTEND_PORT}`;
  
  mainWindow.loadURL(frontendURL);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent navigation to external URLs
    if (!url.startsWith(`http://localhost:${FRONTEND_PORT}`)) {
      event.preventDefault();
      log.warn('Prevented navigation to:', url);
    }
  });

  // Error handling
  mainWindow.webContents.on('crashed', () => {
    log.error('Window crashed!');
    showErrorDialog('Application Error', 'The application has crashed. Please restart.');
  });
}

/**
 * Start the backend server (embedded in Electron)
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    log.info('Starting embedded backend server...');
    
    try {
      // Import and start bundled backend server
      const backendPath = path.join(__dirname, 'backend-bundle.js');
      
      log.info('Backend server path:', backendPath);

      // Set environment variables
      process.env.NODE_ENV = isDev ? 'development' : 'production';
      process.env.PORT = BACKEND_PORT.toString();
      process.env.HOST = BACKEND_HOST;
      // Set user data path for backend to use for all runtime files
      process.env.USER_DATA_PATH = app.getPath('userData');

      log.info(`Backend will start on: http://${BACKEND_HOST}:${BACKEND_PORT}`);

      // Start server
      require(backendPath);
      
      log.info('✅ Backend server started successfully');
      log.info(`🌐 Backend accessible at: http://${BACKEND_HOST}:${BACKEND_PORT}`);
      resolve();
      
    } catch (error) {
      log.error('❌ Failed to start backend:', error);
      reject(error);
    }
  });
}

/**
 * Start the frontend dev server (development only)
 */
function startFrontendDev() {
  return new Promise((resolve, reject) => {
    if (!isDev) {
      return resolve(); // In production, frontend is built
    }

    log.info('Starting frontend dev server...');
    
    const frontendPath = path.join(__dirname, '..', 'local_frontend');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendPath,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    frontendProcess.stdout.on('data', (data) => {
      log.info('[Frontend]', data.toString().trim());
    });

    frontendProcess.stderr.on('data', (data) => {
      log.info('[Frontend]', data.toString().trim());
    });

    frontendProcess.on('error', (error) => {
      log.error('Failed to start frontend:', error);
      reject(error);
    });

    // Wait for frontend to be ready
    setTimeout(() => {
      log.info('Frontend dev server started');
      resolve();
    }, 5000);
  });
}

/**
 * Start production frontend server (serves built files)
 */
function startFrontendProduction() {
  return new Promise((resolve, reject) => {
    log.info('Starting frontend production server...');
    
    const frontendPath = isDev
      ? path.join(__dirname, '..', 'local_frontend', 'dist')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'local_frontend', 'dist');
    
    log.info('Frontend path:', frontendPath);
    log.info('Frontend path exists:', require('fs').existsSync(frontendPath));
    
    const express = require('express');
    const frontendApp = express();
    
    frontendApp.use(express.static(frontendPath));
    
    frontendApp.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
    
    frontendApp.listen(FRONTEND_PORT, () => {
      log.info(`✅ Frontend production server listening on port ${FRONTEND_PORT}`);
      log.info(`🌐 Frontend accessible at: http://localhost:${FRONTEND_PORT}`);
      resolve();
    });
    
    frontendApp.on('error', (error) => {
      log.error('Frontend server error:', error);
      reject(error);
    });
  });
}

/**
 * Show error dialog
 */
function showErrorDialog(title, message) {
  dialog.showErrorBox(title, message);
}

/**
 * Show loading window
 */
function createLoadingWindow() {
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false
    }
  });

  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
  return loadingWindow;
}

/**
 * Initialize the application
 */
async function initialize() {
  log.info('Initializing application...');
  log.info('isDev:', isDev);
  log.info('App path:', app.getAppPath());
  log.info('Resources path:', process.resourcesPath);
  
  const loadingWindow = createLoadingWindow();
  
  try {
    // Start backend
    await startBackend();
    
    // Start frontend (dev or production)
    if (isDev) {
      await startFrontendDev();
    } else {
      await startFrontendProduction();
    }
    
    // Wait a bit more to ensure everything is ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Close loading window and create main window
    loadingWindow.close();
    createWindow();
    
  } catch (error) {
    loadingWindow.close();
    log.error('Failed to initialize:', error);
    showErrorDialog(
      'Startup Error',
      `Failed to start the application:\n${error.message}\n\nPlease check the logs for more details.`
    );
    app.quit();
  }
}

/**
 * Cleanup on exit
 */
function cleanup() {
  log.info('Cleaning up...');
  
  // No backend process to kill since it's embedded
  if (frontendProcess && isDev) {
    log.info('Killing frontend process');
    frontendProcess.kill('SIGTERM');
    frontendProcess = null;
  }
}

// App event handlers
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  cleanup();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// IPC Handlers (for future use)
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

log.info('Electron main process started');

