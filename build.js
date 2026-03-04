#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

const REPLACE_KEYS = new Set(['background', 'permissions', 'web_accessible_resources']);

function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (
      !REPLACE_KEYS.has(key) &&
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function build(target) {
  const outDir = path.join(ROOT, 'build', target);

  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8'));
  const override = JSON.parse(fs.readFileSync(path.join(ROOT, `manifest.${target}.json`), 'utf8'));
  const merged = deepMerge(base, override);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyRecursive(SRC, outDir);

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(merged, null, 2),
    'utf8'
  );

  console.log(`Built ${target} -> build/${target}/`);
}

const arg = process.argv[2];
const targets = arg === 'chrome' ? ['chrome']
  : arg === 'firefox' ? ['firefox']
  : ['chrome', 'firefox'];

for (const t of targets) {
  build(t);
}
