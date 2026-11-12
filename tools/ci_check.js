#!/usr/bin/env node
"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "extension/background.js",
  "extension/content.js",
  "extension/exam_mode.js",
  "extension/popup.js",
  "worker/worker.js",
];
for (const rel of files) {
  execSync(`node --check ${JSON.stringify(path.join(root, rel))}`, {
    stdio: "inherit",
    shell: true,
  });
}
JSON.parse(fs.readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
const raw = fs
  .readFileSync(path.join(root, "worker/wrangler.jsonc"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
JSON.parse(raw);
console.log("OK syntax + manifest + wrangler.jsonc");
