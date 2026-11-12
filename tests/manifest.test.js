"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./harness");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("the MV3 manifest references files that exist, with exam detection first", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "5.0.0");
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.ok(manifest.permissions.includes("storage"));
  const cs = manifest.content_scripts[0];
  assert.deepEqual(cs.js, ["exam_mode.js", "content.js"]);
  assert.ok(cs.css.includes("content.css"));
  const rels = [
    "extension/background.js",
    "extension/content.js",
    "extension/exam_mode.js",
    "extension/popup.js",
    "extension/popup.html",
    "extension/content.css",
    "extension/icons/icon-16.png",
    "extension/icons/icon-32.png",
    "extension/icons/icon-48.png",
    "extension/icons/icon-128.png",
  ];
  for (const rel of rels) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
  }
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.ok(fs.existsSync(path.join(ROOT, "extension", file)), file);
    assert.match(String(size), /^(16|32|48|128)$/);
  }
});

test("popup.html wires the script and expected form fields", () => {
  const html = read("extension/popup.html");
  assert.match(html, /id="key"/);
  assert.match(html, /id="lang"/);
  assert.match(html, /id="save"/);
  assert.match(html, /src="popup.js"/);
});
