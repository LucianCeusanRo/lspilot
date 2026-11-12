"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./harness");

const SKIP = new Set([".git", "node_modules", "icons", "docs"]);
const SECRET_RE = /AIza[0-9A-Za-z\-_]{20,}|sk_live_[0-9A-Za-z]+|sk_test_[0-9A-Za-z]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/;

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name) || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(js|json|jsonc|html|css|md|example|yml)$/i.test(ent.name)) acc.push(full);
  }
  return acc;
}

test("worker defaults do not hardcode API keys or HMAC secrets", () => {
  const src = fs.readFileSync(path.join(ROOT, "worker/worker.js"), "utf8");
  assert.match(src, /const DEFAULT_GEMINI_KEY = '';/);
  assert.match(src, /const DEFAULT_HMAC_SECRET = '';/);
  assert.match(src, /let ADMIN_PASSWORD_SALT = "";/);
  assert.doesNotMatch(src, SECRET_RE);
});

test("the public extension talks to a placeholder worker, not a live account", () => {
  const src = fs.readFileSync(path.join(ROOT, "extension/background.js"), "utf8");
  assert.match(src, /https:\/\/your-worker\.your-subdomain\.workers\.dev/);
  assert.doesNotMatch(src, /slstoresrl\.workers\.dev/);
});

test("no committed source file contains a live-looking secret", () => {
  const files = walk(ROOT, []);
  assert.ok(files.length > 5);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(SECRET_RE);
    assert.equal(m, null, `possible secret in ${path.relative(ROOT, file)}: ${m && m[0].slice(0, 12)}`);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, ".env")));
  assert.ok(fs.existsSync(path.join(ROOT, ".env.example")));
});
