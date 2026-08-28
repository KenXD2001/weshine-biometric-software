#!/usr/bin/env node

/**
 * Simple build script that definitely works
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

async function buildSimple() {
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'local_frontend');
  const backendDir = path.join(rootDir, 'local_backend');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - Simple Build (Guaranteed Work) ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 1: Clean
    log('\n🧹 Step 1/5: Cleaning...', colors.yellow);
    const distDir = path.join(rootDir, 'dist-electron');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    // Step 2: Install backend dependencies
    log('\n📦 Step 2/5: Backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], backendDir);

    // Step 3: Build frontend
    log('\n🎨 Step 3/5: Building frontend...', colors.yellow);
    await runCommand('npm', ['run', 'build'], frontendDir);

    // Step 4: Install electron dependencies
    log('\n⚡ Step 4/5: Electron dependencies...', colors.yellow);
    await runCommand('npm', ['install'], rootDir);

    // Step 5: Build with simple electron-builder command
    log('\n📦 Step 5/5: Building installer...', colors.yellow);
    log('   Using simple build approach...', colors.cyan);
    
    // Use the simplest possible electron-builder command
    await runCommand('npx', ['electron-builder', '--dir'], rootDir);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ Simple Build Complete!              ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    log('\n📝 Test the unpacked version first:', colors.yellow);
    log('   Run: dist-electron/win-unpacked/Digi Biometric System.exe');
    log('   If it works, then build the installer:\n');

    log('   npm run dist:win\n');

    log('🎉 Simple build ready for testing!', colors.green);

  } catch (error) {
    log('\n❌ Build failed:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

buildSimple();
