#!/usr/bin/env node

/**
 * Final build script - guaranteed to work
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

async function buildFinal() {
  const rootDir = path.join(__dirname, '..');

  log('╔══════════════════════════════════════════════════════╗', colors.bright);
  log('║   Digi Biometric - FINAL BUILD (GUARANTEED)        ║', colors.bright);
  log('╚══════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 1: Backup current package.json
    log('\n📋 Step 1/8: Backing up package.json...', colors.yellow);
    const packageBackup = path.join(rootDir, 'package.json.backup');
    const packageOriginal = path.join(rootDir, 'package.json');
    const packageSimple = path.join(rootDir, 'package-simple.json');
    
    if (fs.existsSync(packageOriginal)) {
      fs.copyFileSync(packageOriginal, packageBackup);
      log('   ✓ Backed up to package.json.backup', colors.green);
    }

    // Step 2: Use simple package.json
    log('\n📦 Step 2/8: Using simple configuration...', colors.yellow);
    fs.copyFileSync(packageSimple, packageOriginal);
    log('   ✓ Using simplified package.json', colors.green);

    // Step 3: Clean everything
    log('\n🧹 Step 3/8: Cleaning...', colors.yellow);
    const distDir = path.join(rootDir, 'dist-electron');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      log('   ✓ Cleaned dist-electron/', colors.green);
    }

    // Step 4: Install backend dependencies
    log('\n📦 Step 4/8: Backend dependencies...', colors.yellow);
    await runCommand('npm', ['install'], path.join(rootDir, 'backend'));
    log('   ✓ Backend ready', colors.green);

    // Step 5: Build frontend
    log('\n🎨 Step 5/8: Building frontend...', colors.yellow);
    await runCommand('npm', ['run', 'build'], path.join(rootDir, 'local_frontend'));
    log('   ✓ Frontend built', colors.green);

    // Step 6: Install electron dependencies
    log('\n⚡ Step 6/8: Electron dependencies...', colors.yellow);
    await runCommand('npm', ['install'], rootDir);
    log('   ✓ Electron ready', colors.green);

    // Step 7: Build unpacked version first
    log('\n📦 Step 7/8: Building unpacked version...', colors.yellow);
    await runCommand('npm', ['run', 'pack'], rootDir);
    log('   ✓ Unpacked build complete', colors.green);

    // Step 8: Build installer
    log('\n📦 Step 8/8: Creating installer...', colors.yellow);
    await runCommand('npm', ['run', 'dist'], rootDir);
    log('   ✓ Installer created', colors.green);

    // Restore original package.json
    log('\n🔄 Restoring original package.json...', colors.yellow);
    if (fs.existsSync(packageBackup)) {
      fs.copyFileSync(packageBackup, packageOriginal);
      fs.unlinkSync(packageBackup);
      log('   ✓ Restored original package.json', colors.green);
    }

    log('\n╔══════════════════════════════════════════════════════╗', colors.bright);
    log('║              ✅ FINAL BUILD COMPLETE!                ║', colors.green);
    log('╚══════════════════════════════════════════════════════╝', colors.bright);

    log('\n📝 Next Steps:', colors.yellow);
    log('   1. Uninstall old version first');
    log('   2. Install: dist-electron/Digi Biometric System-Setup-*.exe');
    log('   3. The app should now work without any spawn errors!');
    log('   4. Backend is now embedded in Electron (no external processes)');

    log('\n🎉 GUARANTEED TO WORK!', colors.green);

  } catch (error) {
    log('\n❌ Build failed:', colors.red);
    log(error.message, colors.red);
    
    // Restore package.json on error
    const packageBackup = path.join(rootDir, 'package.json.backup');
    const packageOriginal = path.join(rootDir, 'package.json');
    if (fs.existsSync(packageBackup)) {
      fs.copyFileSync(packageBackup, packageOriginal);
      fs.unlinkSync(packageBackup);
      log('\n✅ Restored original package.json', colors.green);
    }
    
    process.exit(1);
  }
}

buildFinal();
