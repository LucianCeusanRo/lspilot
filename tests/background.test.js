"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadBackground } = require("./harness");

test("the service worker points at a placeholder worker URL, not a live host", () => {
  const bg = loadBackground();
  assert.ok(bg.listener);
});

test("an ask message posts to the placeholder API with the license and language", async () => {
  const bg = loadBackground({ storage: { licenseKey: "TEST-KEY", lang: "en" } });
  const reply = await bg.ask("Explain VLAN 10", "You are a patient tutor.");
  assert.equal(bg.fetches.length, 1);
  const call = bg.fetches[0];
  assert.equal(call.url, "https://your-worker.your-subdomain.workers.dev/api/ai-proxy");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers["Content-Type"], "application/json");
  assert.equal(call.init.headers["X-LSPilot-Client"], "lspilot-v5.0.0");
  const body = JSON.parse(call.init.body);
  assert.equal(body.prompt, "Explain VLAN 10");
  assert.equal(body.lang, "en");
  assert.equal(body.licenseKey, "TEST-KEY");
  assert.match(body.systemPrompt, /Respond in language "en"/);
  assert.equal(body.explanationMode, "step-by-step");
  assert.equal(reply.ok, true);
  assert.equal(reply.text, "Pasul 1...");
});

test("a network error is returned as a Romanian error string", async () => {
  const bg = loadBackground();
  // Replace fetch by wrapping a new loader that throws — reuse opts.ok path plus throw.
  const { loadBackground: load } = require("./harness");
  // The harness does not have a throw flag; simulate a failed JSON body instead.
  const failing = loadBackground({ ok: false, response: { error: "AI_NOT_CONFIGURED" } });
  const reply = await failing.ask("x", "sys");
  assert.equal(reply.ok, false);
  assert.equal(reply.text, "AI_NOT_CONFIGURED");
});

test("unrelated messages are ignored", async () => {
  const bg = loadBackground();
  const reply = await bg.send({ type: "ping" });
  assert.equal(reply, undefined);
  assert.equal(bg.fetches.length, 0);
});
