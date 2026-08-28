#!/usr/bin/env node

/**
 * WORKING BUILD SCRIPT - ONE COMMAND THAT WORKS
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

async function syncDependencies(rootPkgPath, backendPkgPath) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf-8'));
  const rootDeps = rootPkg.dependencies || {};
  const backendDeps = backendPkg.dependencies || {};
  let changed = false;

  // Add missing backend deps to root
  for (const dep in backendDeps) {
    if (!rootDeps[dep]) {
      log(`Adding missing backend dependency to root: ${dep}@${backendDeps[dep]}`, colors.cyan);
      rootDeps[dep] = backendDeps[dep];
      changed = true;
    }
  }
  // Add missing root deps to backend
  for (const dep in rootDeps) {
    if (!backendDeps[dep]) {
      log(`Adding missing root dependency to backend: ${dep}@${rootDeps[dep]}`, colors.cyan);
      backendDeps[dep] = rootDeps[dep];
      changed = true;
    }
  }
  if (changed) {
    rootPkg.dependencies = rootDeps;
    backendPkg.dependencies = backendDeps;
    fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2));
    fs.writeFileSync(backendPkgPath, JSON.stringify(backendPkg, null, 2));
    log('Dependencies synchronized between root and local_backend.', colors.green);
  } else {
    log('Dependencies already synchronized.', colors.green);
  }
}

async function buildWorking() {
  const rootDir = path.join(__dirname, '..');
  const frontendDir = path.join(rootDir, 'local_frontend');
  const backendDir = path.join(rootDir, 'local_backend');
  const rootPkgPath = path.join(rootDir, 'package.json');
  const backendPkgPath = path.join(backendDir, 'package.json');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - WORKING BUILD (GUARANTEED)      ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 0: Sync dependencies
    log('\n🔄 Step 0: Syncing dependencies...', colors.yellow);
    await syncDependencies(rootPkgPath, backendPkgPath);

    // Step 1: Clean
    log('\n🧹 Step 1/5: Cleaning...', colors.yellow);
    const distDir = path.join(rootDir, 'dist-electron');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    // Step 2: Build frontend
    log('\n🎨 Step 2/5: Building frontend...', colors.yellow);
    await runCommand('npm', ['run', 'build'], frontendDir);

    // Step 3: Install dependencies (root)
    log('\n📦 Step 3/5: Installing root dependencies...', colors.yellow);
    await runCommand('npm', ['install'], rootDir);

    // Step 4: Install dependencies (backend)
    log('\n📦 Step 4/5: Installing backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], backendDir);

    // Step 5: Build installer
    log('\n📦 Step 5/5: Creating installer...', colors.yellow);
    await runCommand('npx', ['electron-builder', '--win', '--x64'], rootDir);

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ BUILD COMPLETE!                      ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    log('\n📝 Next Steps:', colors.yellow);
    log('   1. Uninstall old version');
    log('   2. Install: dist-electron/Digi Biometric System-Setup-*.exe');
    log('   3. App should work without any errors!');

    log('\n🎉 READY TO DISTRIBUTE!', colors.green);

  } catch (error) {
    log('\n❌ Build failed:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

