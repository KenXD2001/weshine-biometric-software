#!/usr/bin/env node

/**
 * Rebuild with Node.js bundling fix
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
    log(`Running: ${command} ${args.join(' ')}`, colors.cyan);
    
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

async function rebuildFixed() {
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'local_frontend');
  const backendDir = path.join(rootDir, 'local_backend');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - Rebuild with Node.js Fix       ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 1: Clean everything
    log('\n🧹 Step 1/6: Cleaning previous builds...', colors.yellow);
    const distDir = path.join(rootDir, 'dist-electron');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      log('   ✓ Removed dist-electron/', colors.green);
    }

    // Step 2: Install backend dependencies
    log('\n📦 Step 2/6: Installing backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], backendDir);
    log('   ✓ Backend dependencies installed', colors.green);

    // Step 3: Build frontend
    log('\n🎨 Step 3/6: Building frontend...', colors.yellow);
    await runCommand('npm', ['run', 'build'], frontendDir);
    log('   ✓ Frontend built', colors.green);

    // Step 4: Verify backend structure
    log('\n🔍 Step 4/6: Verifying backend structure...', colors.yellow);
    const expressPath = path.join(backendDir, 'node_modules', 'express');
    if (!fs.existsSync(expressPath)) {
      throw new Error('Express not found in backend node_modules!');
    }
    log('   ✓ Backend structure verified', colors.green);

    // Step 5: Install Electron dependencies
    log('\n⚡ Step 5/6: Installing Electron dependencies...', colors.yellow);
    await runCommand('npm', ['install'], rootDir);
    log('   ✓ Electron dependencies installed', colors.green);

    // Step 6: Build with electron-builder
    log('\n📦 Step 6/6: Creating Windows installer with Node.js fix...', colors.yellow);
    log('   This will take several minutes...', colors.cyan);
    
    // Use electron-builder directly with verbose output
    await runCommand('npx', ['electron-builder', '--win', '--x64'], rootDir);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ Rebuild Complete!                   ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    log('\n📝 Next Steps:', colors.yellow);
    log('   1. Uninstall the old version first');
    log('   2. Install: dist-electron/Digi Biometric System-Setup-*.exe');
    log('   3. The app should now start without "spawn node ENOENT" error');
    log('   4. Test all features\n');

    log('🎉 Fixed build ready!', colors.green);

  } catch (error) {
    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║                  ❌ Rebuild Failed!                  ║', colors.red);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);
    log(`\n❌ Error: ${error.message}\n`, colors.red);

    process.exit(1);
  }
}

rebuildFixed();
