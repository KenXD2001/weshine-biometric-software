#!/usr/bin/env node

/**
 * Complete build script for Digi Biometric Desktop
 * Builds frontend, prepares backend, and creates installer
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function build() {
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'local_frontend');
  const backendDir = path.join(rootDir, 'local_backend');
  const distDir = path.join(rootDir, 'dist-electron');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric Desktop - Complete Build Process   ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  const startTime = Date.now();

  try {
    // Step 1: Clean previous build
    log('\n🧹 Step 1/4: Cleaning previous build...', colors.yellow);
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      log('   ✓ Removed dist-electron/', colors.green);
    }
    const frontendDist = path.join(frontendDir, 'dist');
    if (fs.existsSync(frontendDist)) {
      fs.rmSync(frontendDist, { recursive: true, force: true });
      log('   ✓ Removed frontend/dist/', colors.green);
    }

    // Step 2: Build Frontend
    log('\n🎨 Step 2/4: Building frontend (React + Vite)...', colors.yellow);
    log('   This may take a few minutes...', colors.cyan);
    await runCommand('npm', ['run', 'build'], frontendDir);
    log('   ✓ Frontend built successfully', colors.green);

    // Verify frontend build
    if (!fs.existsSync(path.join(frontendDir, 'dist', 'index.html'))) {
      throw new Error('Frontend build failed - index.html not found');
    }

    // Step 3: Prepare Backend (bundled approach)
    log('\n⚙️  Step 3/4: Preparing backend...', colors.yellow);
    log('   Using bundled backend approach...', colors.cyan);
    log('   ✓ Backend prepared (bundled)', colors.green);

    // Step 4: Create Electron Package
    log('\n📦 Step 4/4: Creating Windows installer...', colors.yellow);
    log('   Packaging with electron-builder...', colors.cyan);
    log('   This will take several minutes...', colors.cyan);
    await runCommand('npm', ['run', 'dist:win'], rootDir);

    // Build complete
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ Build Completed Successfully!        ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    // Show output files
    log(`\n📊 Build Statistics:`, colors.cyan);
    log(`   ⏱️  Duration: ${duration} seconds`);
    log(`   📂 Output directory: dist-electron/\n`);

    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      log('📦 Generated Files:', colors.cyan);
      
      files.forEach(file => {
        const filePath = path.join(distDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && file.endsWith('.exe')) {
          log(`   ✓ ${file} (${formatBytes(stats.size)})`, colors.green);
        }
      });
    }

    log('\n📝 Next Steps:', colors.yellow);
    log('   1. Test the installer: dist-electron/Digi Biometric System-Setup-*.exe');
    log('   2. Install on a test machine');
    log('   3. Verify SecuGen device works');
    log('   4. Test all features');
    log('   5. Distribute to users!\n');

    log('🎉 Ready for distribution!', colors.green);

  } catch (error) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║                  ❌ Build Failed!                    ║', colors.red);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);
    log(`\n⏱️  Failed after ${duration} seconds`, colors.red);
    log(`❌ Error: ${error.message}\n`, colors.red);

    log('💡 Troubleshooting Tips:', colors.yellow);
    log('   1. Run: npm run install-all');
    log('   2. Check if all dependencies are installed');
    log('   3. Ensure frontend builds: cd frontend && npm run build');
    log('   4. Check logs above for specific errors\n');

    process.exit(1);
  }
}

build();

