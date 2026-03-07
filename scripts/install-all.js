#!/usr/bin/env node

/**
 * Install all dependencies for the entire project
 * Runs: npm install in root, backend, and frontend
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
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    log(`\n📦 Installing dependencies in: ${cwd}`, colors.blue);
    
    const process = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        log(`✅ Successfully installed dependencies in: ${cwd}`, colors.green);
        resolve();
      } else {
        log(`❌ Failed to install dependencies in: ${cwd}`, colors.red);
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    process.on('error', (error) => {
      log(`❌ Error: ${error.message}`, colors.red);
      reject(error);
    });
  });
}

async function installAll() {
  const rootDir = path.join(__dirname, '..');
  const backendDir = path.join(rootDir, 'local_backend');
  const frontendDir = path.join(rootDir, 'local_frontend');

  log('╔════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - Install All Dependencies   ║', colors.bright);
  log('╚════════════════════════════════════════════════╝', colors.bright);

  try {
    // Check if directories exist
    if (!fs.existsSync(backendDir)) {
      throw new Error('Backend directory not found');
    }
    if (!fs.existsSync(frontendDir)) {
      throw new Error('Frontend directory not found');
    }

    // Install root dependencies (Electron)
    log('\n🔧 Step 1/3: Installing root dependencies (Electron)...', colors.yellow);
    await runCommand('npm', ['install'], rootDir);

    // Install backend dependencies
    log('\n🔧 Step 2/3: Installing backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], backendDir);

    // Install frontend dependencies
    log('\n🔧 Step 3/3: Installing frontend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], frontendDir);

    log('\n╔════════════════════════════════════════════════╗', colors.bright);
    log('║            ✅ Installation Complete!           ║', colors.green);
    log('╚════════════════════════════════════════════════╝', colors.bright);
    log('\n📝 Next steps:', colors.yellow);
    log('  1. Create .env file in backend/ (copy from .env.example)');
    log('  2. Add icon.ico to electron/resources/');
    log('  3. Run: npm run electron:dev (to test)');
    log('  4. Run: npm run dist:win (to build installer)\n');

  } catch (error) {
    log('\n❌ Installation failed!', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

installAll();

