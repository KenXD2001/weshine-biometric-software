#!/usr/bin/env node

/**
 * Fix build script - Rebuild with proper backend dependencies
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

async function fixBuild() {
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'local_frontend');
  const backendDir = path.join(rootDir, 'backend');
  const distDir = path.join(rootDir, 'dist-electron');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - Fix Build Process               ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 1: Clean previous build
    log('\n🧹 Step 1/5: Cleaning previous build...', colors.yellow);
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      log('   ✓ Removed dist-electron/', colors.green);
    }

    // Step 2: Ensure backend has all dependencies
    log('\n📦 Step 2/5: Ensuring backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], backendDir);
    log('   ✓ Backend dependencies ready', colors.green);

    // Step 3: Build Frontend
    log('\n🎨 Step 3/5: Building frontend...', colors.yellow);
    await runCommand('npm', ['run', 'build'], frontendDir);
    log('   ✓ Frontend built successfully', colors.green);

    // Step 4: Verify backend structure
    log('\n🔍 Step 4/5: Verifying backend structure...', colors.yellow);
    const backendNodeModules = path.join(backendDir, 'node_modules');
    if (!fs.existsSync(backendNodeModules)) {
      throw new Error('Backend node_modules not found!');
    }
    
    const expressPath = path.join(backendNodeModules, 'express');
    if (!fs.existsSync(expressPath)) {
      throw new Error('Express module not found in backend!');
    }
    
    log('   ✓ Backend structure verified', colors.green);

    // Step 5: Build with electron-builder
    log('\n📦 Step 5/5: Creating Windows installer...', colors.yellow);
    log('   This will take several minutes...', colors.cyan);
    
    await runCommand('npm', ['run', 'dist:win'], rootDir);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ Build Fixed Successfully!           ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    log('\n📝 Next Steps:', colors.yellow);
    log('   1. Test the new installer: dist-electron/Digi Biometric System-Setup-*.exe');
    log('   2. Uninstall the old version first');
    log('   3. Install the new version');
    log('   4. Test all features\n');

    log('🎉 Fixed build ready for testing!', colors.green);

  } catch (error) {
    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║                  ❌ Fix Failed!                      ║', colors.red);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);
    log(`\n❌ Error: ${error.message}\n`, colors.red);

    log('💡 Manual Fix Steps:', colors.yellow);
    log('   1. cd backend && npm install');
    log('   2. cd frontend && npm run build');
    log('   3. npm run dist:win');
    log('   4. Test the new installer\n');

    process.exit(1);
  }
}

fixBuild();
