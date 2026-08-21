#!/usr/bin/env node
/**
 * Gate de licenças — barra copyleft viral na árvore de produção.
 *
 * A auditoria (LICENSE_AUDIT.md) confirmou zero GPL/AGPL/LGPL hoje. Este script
 * existe para impedir a REGRESSÃO: se uma dependência copyleft entrar via
 * `npm install` de qualquer transitiva, o CI falha antes do merge.
 *
 * Não usa `license-checker` de propósito — instalar uma dependência só para
 * conferir dependências é rodar o toolchain a cada CI sem necessidade. Varre o
 * node_modules real a partir das deps de produção do package.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Licenças que contaminariam um produto de código fechado distribuído. */
const BLOCKED = [/\bGPL-/i, /\bAGPL-/i, /\bLGPL-/i, /\bSSPL/i, /\bCC-BY-NC/i];

/** Lê a licença declarada de um pacote, tolerando os formatos legados. */
function readLicense(pkgDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    if (typeof pkg.license === 'string') return pkg.license;
    if (pkg.license && pkg.license.type) return pkg.license.type;
    if (Array.isArray(pkg.licenses)) {
      return pkg.licenses.map((l) => l.type || l).join(' OR ');
    }
    return 'UNKNOWN';
  } catch {
    return null;
  }
}

/** Percorre a árvore de produção a partir das dependencies do package.json. */
function collect() {
  const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const queue = Object.keys(root.dependencies || {});
  const visited = new Set();
  const found = new Map();

  while (queue.length > 0) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);

    const dir = path.join('node_modules', name);
    if (!fs.existsSync(dir)) continue;

    const license = readLicense(dir);
    if (license !== null) found.set(name, license);

    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      queue.push(...Object.keys(pkg.dependencies || {}));
    } catch {
      // Pacote sem manifesto legível: ignora a expansão, mas não a licença.
    }
  }
  return found;
}

const licenses = collect();
const offenders = [];
for (const [name, license] of licenses) {
  if (BLOCKED.some((rule) => rule.test(license))) {
    offenders.push(`${name} — ${license}`);
  }
}

if (offenders.length > 0) {
  console.error('❌ Licença copyleft/viral encontrada na árvore de produção:');
  offenders.forEach((o) => console.error(`   - ${o}`));
  console.error(
    '\nProduto distribuído de código fechado não pode incluir GPL/AGPL/LGPL/SSPL.',
  );
  console.error('Revise a dependência ou isole-a. Ver LICENSE_AUDIT.md.');
  process.exit(1);
}

console.log(
  `✅ ${licenses.size} pacotes de produção auditados — nenhuma licença copyleft viral.`,
);
