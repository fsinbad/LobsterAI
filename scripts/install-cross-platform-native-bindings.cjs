#!/usr/bin/env node
'use strict';

/**
 * Install cross-platform native bindings that npm fails to install due to
 * https://github.com/npm/cli/issues/4828 (optional dependencies bug).
 *
 * When building for a target platform different from the host (e.g. building
 * win-x64 on macOS), npm skips optional dependencies whose `os`/`cpu` fields
 * don't match the host. This script scans every package in node_modules for
 * optionalDependencies, identifies platform-specific variants matching the
 * target, and installs them via `npm pack` + extraction.
 *
 * Usage:
 *   node scripts/install-cross-platform-native-bindings.cjs <runtimeDir> <platform> <arch>
 *
 * Example:
 *   node scripts/install-cross-platform-native-bindings.cjs vendor/openclaw-runtime/win-x64 win32 x64
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Platform mapping ──────────────────────────────────────────────────────

const PLATFORM_MAP = {
  win32: 'win32',
  darwin: 'darwin',
  linux: 'linux',
};

const ARCH_MAP = {
  x64: 'x64',
  arm64: 'arm64',
  ia32: 'ia32',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[native-bindings] ${msg}`);
}

function warn(msg) {
  console.warn(`[native-bindings] WARNING: ${msg}`);
}

/**
 * Collect all package.json paths under a node_modules directory,
 * including nested scoped packages (@scope/pkg) and nested node_modules
 * (e.g. third-party-extensions/*\/node_modules).
 */
function findPackageJsons(nodeModulesDir) {
  const results = [];

  function walk(dir, depth) {
    if (depth > 3) return; // node_modules/scope/pkg/node_modules/scope/pkg
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name);
      if (name === 'node_modules') {
        walk(full, depth + 1);
        continue;
      }
      // Check if this directory is a package (has package.json)
      const pkgJsonPath = path.join(full, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        results.push(pkgJsonPath);
        // Also check for nested node_modules inside this package
        const nestedNm = path.join(full, 'node_modules');
        if (fs.existsSync(nestedNm)) {
          walk(nestedNm, depth + 1);
        }
      }
      // Check for scoped packages (@scope/pkg)
      if (name.startsWith('@') && depth < 3) {
        walk(full, depth);
      }
    }
  }

  walk(nodeModulesDir, 0);
  return results;
}

/**
 * Determine if a package name looks like a platform-specific native binding
 * for the given target platform and arch.
 *
 * Patterns:
 *   @scope/pkg-win32-x64
 *   @scope/pkg-win32-x64-msvc
 *   @scope/pkg-darwin-arm64
 *   @scope/pkg-linux-x64-gnu
 *   pkg-windows-x64
 *   etc.
 */
function isPlatformBinding(pkgName, targetPlatform, targetArch) {
  // Extract platform/arch tokens from the package name suffix
  const lower = pkgName.toLowerCase();

  // Common patterns:
  //   -win32-x64, -win32-x64-msvc, -darwin-arm64, -linux-x64-gnu, etc.
  //   -windows-x64 (sqlite-vec)
  const platformTokens = [targetPlatform];
  // Some packages use "windows" instead of "win32"
  if (targetPlatform === 'win32') {
    platformTokens.push('windows');
  }

  const archToken = targetArch;

  for (const plat of platformTokens) {
    // Check if the package name contains both the platform and arch tokens
    // e.g. "davey-win32-x64-msvc" contains "win32" and "x64"
    const platIdx = lower.lastIndexOf(`-${plat}`);
    if (platIdx === -1) continue;

    // The arch token should appear after the platform token
    const afterPlat = lower.slice(platIdx + plat.length + 1);
    if (afterPlat.startsWith(archToken) || afterPlat.startsWith(`-${archToken}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if a package is the CURRENT host platform variant (should be kept).
 */
function isHostBinding(pkgName) {
  const hostPlatform = PLATFORM_MAP[os.platform()] || os.platform();
  const hostArch = ARCH_MAP[os.arch()] || os.arch();
  return isPlatformBinding(pkgName, hostPlatform, hostArch);
}

/**
 * Get the base package name (without platform suffix).
 * e.g. "@snazzah/davey-win32-x64-msvc" -> "@snazzah/davey"
 */
function getBaseName(pkgName) {
  // Remove platform suffixes like -win32-x64, -darwin-arm64, -linux-x64-gnu, etc.
  const patterns = [
    /-win32-(x64|ia32|arm64)(-msvc)?$/,
    /-windows-(x64|ia32|arm64)$/,
    /-darwin-(x64|arm64)(-universal)?$/,
    /-linux-(x64|arm64|arm)(-gnu|-musl)?$/,
    /-linux-arm(gnueabihf)?$/,
    /-freebsd-(x64|arm64)$/,
    /-android-(arm64|arm-eabi)$/,
    /-wasm32-wasi$/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(pkgName)) {
      return pkgName.replace(pattern, '');
    }
  }
  return null; // Not a platform-specific package
}

// ─── Install a single package via npm pack ─────────────────────────────────

function installPackage(pkgName, version, nodeModulesDir) {
  const tmpDir = os.tmpdir();
  const scope = pkgName.startsWith('@') ? pkgName.split('/')[0] : null;
  const installDir = scope
    ? path.join(nodeModulesDir, scope, pkgName.split('/')[1])
    : path.join(nodeModulesDir, pkgName);

  // Check if already installed
  if (fs.existsSync(path.join(installDir, 'package.json'))) {
    return false;
  }

  const spec = `${pkgName}@${version}`;
  log(`Installing ${spec} ...`);

  try {
    // Download the package tarball
    execFileSync('npm', ['pack', spec, '--pack-destination', tmpDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });
  } catch (e) {
    warn(`Failed to download ${spec}: ${e.message}`);
    return false;
  }

  // Find the tarball
  const tarballName = pkgName.replace('@', '').replace(/\//g, '-') + `-${version}.tgz`;
  const tarballPath = path.join(tmpDir, tarballName);
  if (!fs.existsSync(tarballPath)) {
    warn(`Tarball not found: ${tarballPath}`);
    return false;
  }

  // Create the install directory
  const parentDir = path.dirname(installDir);
  fs.mkdirSync(parentDir, { recursive: true });

  // Extract
  const extractDir = fs.mkdtempSync(path.join(tmpDir, 'native-binding-'));
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', extractDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const packageDir = path.join(extractDir, 'package');
    if (!fs.existsSync(packageDir)) {
      warn(`Unexpected tarball structure for ${spec}: no package/ dir`);
      return false;
    }

    // Move to node_modules
    fs.cpSync(packageDir, installDir, { recursive: true });
    log(`Installed ${spec} -> ${path.relative(nodeModulesDir, installDir)}`);
    return true;
  } finally {
    // Cleanup
    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(tarballPath); } catch {}
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const runtimeDir = process.argv[2];
  const targetPlatform = process.argv[3];
  const targetArch = process.argv[4];

  if (!runtimeDir || !targetPlatform || !targetArch) {
    console.error('Usage: node install-cross-platform-native-bindings.cjs <runtimeDir> <platform> <arch>');
    console.error('Example: node install-cross-platform-native-bindings.cjs vendor/openclaw-runtime/win-x64 win32 x64');
    process.exit(1);
  }

  const hostPlatform = PLATFORM_MAP[os.platform()] || os.platform();
  const hostArch = ARCH_MAP[os.arch()] || os.arch();

  if (hostPlatform === targetPlatform && hostArch === targetArch) {
    log('Host platform matches target — no cross-platform bindings needed.');
    return;
  }

  const nodeModulesDir = path.join(runtimeDir, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    warn(`node_modules not found: ${nodeModulesDir}`);
    return;
  }

  log(`Scanning for missing ${targetPlatform}-${targetArch} native bindings (host: ${hostPlatform}-${hostArch}) ...`);

  const pkgJsonPaths = findPackageJsons(nodeModulesDir);
  log(`Found ${pkgJsonPaths.length} packages.`);

  const bindingsToInstall = new Map(); // pkgName -> version

  for (const pkgJsonPath of pkgJsonPaths) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      continue;
    }

    const optionalDeps = pkg.optionalDependencies || {};
    for (const [depName, depVersion] of Object.entries(optionalDeps)) {
      if (isPlatformBinding(depName, targetPlatform, targetArch)) {
        bindingsToInstall.set(depName, depVersion);
      }
    }
  }

  if (bindingsToInstall.size === 0) {
    log('No missing platform-specific bindings found.');
    return;
  }

  log(`Found ${bindingsToInstall.size} binding(s) to install.`);
  let installed = 0;
  let failed = 0;

  for (const [pkgName, version] of bindingsToInstall) {
    if (installPackage(pkgName, version, nodeModulesDir)) {
      installed++;
    } else {
      failed++;
    }
  }

  log(`Done: ${installed} installed, ${failed} skipped/failed.`);
}

main();
