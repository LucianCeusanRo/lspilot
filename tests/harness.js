"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function element(overrides) {
  const el = {
    id: "",
    tagName: "DIV",
    textContent: "",
    innerText: "",
    innerHTML: "",
    style: { cssText: "", display: "" },
    dataset: {},
    children: [],
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return this; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    onclick: null,
  };
  return Object.assign(el, overrides || {});
}

function loadScript(rel, extras) {
  const ctx = Object.assign({}, extras || {});
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInContext(src, ctx, { filename: rel });
  return ctx;
}

function loadExamMode(opts) {
  opts = opts || {};
  const pathname = opts.pathname || "/course/view.php";
  const html = opts.html || "<html><body>Moodle course</body></html>";
  const userAgent = opts.userAgent || "Mozilla/5.0";
  const queryMap = opts.queryMap || {};
  const isTop = opts.isTop !== false;
  const created = [];

  const documentElement = {
    innerHTML: html,
    appendChild() {},
  };
  const body = element({ id: "body" });
  const document = {
    documentElement,
    body,
    getElementById(id) {
      if (Object.prototype.hasOwnProperty.call(queryMap, "#" + id)) return queryMap["#" + id];
      return null;
    },
    querySelector(sel) {
      if (Object.prototype.hasOwnProperty.call(queryMap, sel)) return queryMap[sel];
      return null;
    },
    querySelectorAll(sel) {
      if (Object.prototype.hasOwnProperty.call(queryMap, sel)) return queryMap[sel];
      return [];
    },
    createElement(tag) {
      const el = element({ tagName: String(tag).toUpperCase() });
      created.push(el);
      return el;
    },
  };
  const location = { pathname, href: "https://moodle.example.edu" + pathname };
  const navigator = { userAgent };
  const windowObj = {
    document,
    navigator,
    location,
    SafeExamBrowser: opts.SafeExamBrowser,
    __PROCTORIO__: opts.__PROCTORIO__,
    Honorlock: opts.Honorlock,
    console,
  };
  windowObj.window = windowObj;
  windowObj.top = isTop ? windowObj : { __other: true };

  const ctx = loadScript("extension/exam_mode.js", {
    window: windowObj,
    document,
    navigator,
    location,
    console,
  });
  return {
    exam: ctx.window.__LSPILOT_EXAM_MODE__,
    reasons: ctx.window.__LSPILOT_EXAM_REASONS__,
    created,
    window: ctx.window,
    document,
  };
}

function loadContent(opts) {
  opts = opts || {};
  const pathname = opts.pathname || "/mod/book/view.php";
  const examMode = !!opts.examMode;
  const body = Object.prototype.hasOwnProperty.call(opts, "body") ? opts.body : null;
  const queryMap = opts.queryMap || {};
  const messages = [];
  const store = { history: [], practiceSets: [] };

  const document = {
    body,
    documentElement: { innerHTML: "", innerText: "" },
    querySelector(sel) {
      if (Object.prototype.hasOwnProperty.call(queryMap, sel)) return queryMap[sel];
      return null;
    },
    querySelectorAll(sel) {
      if (Object.prototype.hasOwnProperty.call(queryMap, sel)) return queryMap[sel];
      return [];
    },
    createElement(tag) { return element({ tagName: String(tag).toUpperCase() }); },
  };
  const location = { pathname, href: "https://moodle.example.edu" + pathname };
  const windowObj = {
    document,
    location,
    __LSPILOT_EXAM_MODE__: examMode,
    top: null,
    getSelection: () => ({ toString: () => opts.selection || "" }),
  };
  windowObj.window = windowObj;
  windowObj.top = opts.isTop === false ? { __other: true } : windowObj;

  const chrome = {
    runtime: {
      sendMessage(msg, cb) {
        messages.push(msg);
        if (cb) cb({ ok: true, text: "mock" });
      },
    },
    storage: {
      local: {
        get(def, cb) {
          const val = Object.assign({}, def, store);
          if (typeof cb === "function") cb(val);
          return Promise.resolve(val);
        },
        set(val, cb) {
          Object.assign(store, val);
          if (typeof cb === "function") cb();
          return Promise.resolve();
        },
        remove(keys, cb) {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          if (typeof cb === "function") cb();
          return Promise.resolve();
        },
      },
    },
  };

  const ctx = loadScript("extension/content.js", {
    window: windowObj,
    document,
    location,
    chrome,
    getSelection: windowObj.getSelection,
    console,
  });
  return {
    study: ctx.window.__LSPILOT_STUDY__,
    examEarlyExit: examMode && !ctx.window.__LSPILOT_STUDY__,
    messages,
    store,
    window: ctx.window,
    document,
    chrome,
  };
}

function loadBackground(opts) {
  opts = opts || {};
  const fetches = [];
  const replies = [];
  let listener = null;
  const chrome = {
    runtime: {
      onMessage: {
        addListener(fn) { listener = fn; },
      },
    },
    storage: {
      local: {
        get(def) {
          return Promise.resolve(Object.assign({ licenseKey: "", lang: "ro" }, def, opts.storage || {}));
        },
      },
    },
  };
  const fetchFn = async (url, init) => {
    fetches.push({ url, init });
    const payload = opts.response || { answer: "Pasul 1..." };
    const ok = opts.ok !== false;
    return {
      ok,
      json: async () => payload,
    };
  };
  const ctx = loadScript("extension/background.js", { chrome, fetch: fetchFn, console });
  return {
    listener,
    fetches,
    replies,
    ask(prompt, system) {
      return new Promise((resolve) => {
        const keep = listener({ type: "ask", prompt, system: system || "You are a tutor." }, {}, resolve);
        if (!keep) resolve(undefined);
      });
    },
    send(msg) {
      return new Promise((resolve) => {
        const keep = listener(msg, {}, resolve);
        if (!keep) resolve(undefined);
      });
    },
  };
}

module.exports = { ROOT, element, loadExamMode, loadContent, loadBackground };
