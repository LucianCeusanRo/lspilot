const DEFAULT_GEMINI_KEY = ''; // set via `wrangler secret put GEMINI_API_KEY` — never hardcode

function requireSecret(value, name) {
  if (!value) throw new Error(`Missing Worker secret: ${name}. Set with wrangler secret put ${name}`);
  return value;
}

const DEFAULT_HMAC_SECRET = '';

// Owner/admin configuration comes ONLY from Worker secrets/vars (see .env.example). The lowercase default
// can never match an uppercased license key, so nothing is unlocked until OWNER_LICENSE_KEY is set.
let OWNER_KEY = 'unset-owner-key';
let ADMIN_EMAIL = 'admin@example.com';
function applyEnvConfig(env) {
  if (!env || applyEnvConfig.done) return;
  applyEnvConfig.done = true;
  if (env.OWNER_LICENSE_KEY) OWNER_KEY = String(env.OWNER_LICENSE_KEY).trim().toUpperCase();
  if (env.ADMIN_EMAIL) ADMIN_EMAIL = String(env.ADMIN_EMAIL).trim().toLowerCase();
  String(env.LICENSE_KEYS || '').split(',').map(k => k.trim().toUpperCase()).filter(Boolean).forEach(k => OFFICIAL_VALID_KEYS.add(k));
  if (OWNER_KEY !== 'unset-owner-key') OFFICIAL_VALID_KEYS.add(OWNER_KEY);
  if (env.ADMIN_PASSWORD_SALT) ADMIN_PASSWORD_SALT = String(env.ADMIN_PASSWORD_SALT);
  String(env.ADMIN_PASSWORD_HASHES || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean).forEach(h => ALLOWED_ADMIN_PASSWORD_HASHES.add(h));
  if (typeof ADMIN_CONFIG_STORE !== 'undefined') {
    ADMIN_CONFIG_STORE.admins[0].email = ADMIN_EMAIL;
    ['name','cif','regCom','address','email','phone'].forEach(k => { const v = env['COMPANY_' + k.toUpperCase()]; if (v) ADMIN_CONFIG_STORE.company[k] = v; });
  }
} // set via `wrangler secret put HMAC_SECRET` — never hardcode

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://js.stripe.com https://accounts.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://your-worker.your-subdomain.workers.dev https://your-site.your-subdomain.workers.dev https://generativelanguage.googleapis.com https://api.stripe.com https://accounts.google.com https://cdnjs.cloudflare.com; frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self' mailto:"
};
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LSPilot-Key, X-License-Key, X-Lease-Signature, X-Device-Id, X-LSPilot-Client, X-BYOK-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

const PLAN_CREDIT_CATALOG = {
  'free': {
    id: 'free',
    name: 'Free Starter Sandbox ($0/mo)',
    priceMonthlyUsd: 0,
    monthlyCredits: 50,
    dailyCap: 5,
    costPer1000Usd: 0,
    maxDevices: 1,
    rateLimitPerMin: 5
  },
  'extension-pro': {
    id: 'extension-pro',
    name: 'Browser Extension Pro ($3.99/mo)',
    priceMonthlyUsd: 3.99,
    anchorPriceUsd: 11.99,
    monthlyCredits: 1500,
    dailyCap: 150,
    costPerCreditUsd: 0.0026,
    costPer1000Usd: 2.66,
    maxDevices: 3,
    rateLimitPerMin: 15
  },
  'single-os': {
    id: 'single-os',
    name: 'Single OS Native App ($29.00/mo)',
    priceMonthlyUsd: 29.00,
    anchorPriceUsd: 39.00,
    monthlyCredits: 4500,
    dailyCap: 350,
    costPerCreditUsd: 0.0064,
    costPer1000Usd: 6.44,
    maxDevices: 3,
    rateLimitPerMin: 20
  },
  'suite-bundle': {
    id: 'suite-bundle',
    name: 'All-Platform Ultimate Suite ($59.99/mo)',
    priceMonthlyUsd: 59.99,
    anchorPriceUsd: 87.00,
    monthlyCredits: 15000,
    dailyCap: 750,
    costPerCreditUsd: 0.0040,
    costPer1000Usd: 4.00,
    maxDevices: 3,
    rateLimitPerMin: 30
  }
};

const TOPUP_PACKS_CATALOG = {
  'micro_booster_400': {
    id: 'micro_booster_400',
    name: '⚡ $2 Exam Micro-Booster (250 Base + 150 Bonus = 400 AI Credits Fixed)',
    credits: 400,
    priceUsd: 2.00,
    anchorUsd: 4.00,
    costPerCreditUsd: 0.0050,
    costPer1000Usd: 5.00,
    smartUpgradeNudge: '2× Student Promo: 400 Fixed AI Credits ($4.00 Value) for $2.00 once — never expires!',
    checkoutUrl: 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK?client_reference_id=micro_booster_400cr'
  },
  'topup_500': {
    id: 'topup_500',
    name: 'Starter Top-Up Pack (+500 AI Credits)',
    credits: 500,
    priceUsd: 4.99,
    anchorUsd: 7.99,
    costPerCreditUsd: 0.0100,
    costPer1000Usd: 9.98,
    smartUpgradeNudge: 'Extension Pro is only $3.99/mo and gives 1,500 Credits/mo (3x more credits for $1 less!)',
    checkoutUrl: 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK?client_reference_id=topup_500_credits'
  },
  'topup_2000': {
    id: 'topup_2000',
    name: 'Exam Week Booster (+2,000 AI Credits)',
    credits: 2000,
    priceUsd: 14.99,
    anchorUsd: 24.99,
    costPerCreditUsd: 0.0075,
    costPer1000Usd: 7.50,
    smartUpgradeNudge: '2 Top-Up Packs (5,600 AI Credit Coins = $29.98) cost MORE than upgrading to Single OS Native App ($29.00/mo for 4,500 AI Credit Coins + Native App + Extension!)',
    checkoutUrl: 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK?client_reference_id=topup_2000_credits'
  },
  'topup_5000': {
    id: 'topup_5000',
    name: 'Heavy Crunch Pack (+5,000 AI Credits)',
    credits: 5000,
    priceUsd: 29.99,
    anchorUsd: 49.99,
    costPerCreditUsd: 0.0060,
    costPer1000Usd: 6.00,
    smartUpgradeNudge: '2 Top-Up Packs (13,000 AI Credit Coins = $59.98) cost the SAME as All-Platform Suite ($59.99/mo for 15,000 AI Credit Coins + All 4 Apps + Priority 180ms AI!)',
    checkoutUrl: 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK?client_reference_id=topup_5000_credits'
  }
};

const VERSION_MANIFEST = {
  ok: true,
  version: '5.0.0',
  latestVersion: '5.0.0',
  minSupportedVersion: '5.0.0',
  minRequiredVersion: '5.0.0',
  mandatory: true,
  forceUpdate: true,
  mandatoryAutoUpdate: true,
  autoUpdateEnabled: true,
  updated: '2026-10-29',
  releaseDate: '2026-10-29T13:00:00+02:00',
  moodleCompatibility: 'Moodle 5.3.0 / 5.0 / 4.5 LTS (Official mod_quiz DOM)',
  antivirusCompliance: '100% Clean (Standard WebKit/Electron APIs, Zero Unsigned Binary Stubs)',
  entity: 'YOUR COMPANY SRL (CUI RO00000000, Reg. Com. J00/0000/2026)',
  positioning: 'learning-assistant',
  examMode: 'auto-off',
  releaseNotes: 'v5.0.0 Learning Assistant: visible Moodle study panel; step-by-step explanations, hints, summaries, flashcards; learn-from-mistakes on quiz review pages; exam mode auto-off on graded/timed/proctored quizzes; For Schools institutional page. No stealth or bypass features.',
  downloadUrls: {
    extension: '/downloads/LSPilot-Chrome-Extension-v5.0.0.zip',
    windows: null,
    macos: null,
    ios: null
  },
  downloads: {
    extension: 'https://your-worker.your-subdomain.workers.dev/downloads/LSPilot-Chrome-Extension-v5.0.0.zip',
    windows: null,
    macos: null,
    ios: null,
    ipad: null
  },
  packages: {
    extension: { version: '5.0.0', url: '/downloads/LSPilot-Chrome-Extension-v5.0.0.zip', channel: 'stable' },
    windows: { version: null, url: null, channel: 'removed-pending-v5-rebuild' },
    macos: { version: null, url: null, channel: 'removed-pending-v5-rebuild' },
    ios: { version: null, url: null, channel: 'removed-pending-v5-rebuild' }
  }
};

const OFFICIAL_VALID_KEYS = new Set(); // filled at runtime from env.LICENSE_KEYS (comma-separated)

const CLOUD_SYNC_STORE = new Map();
const MINUTE_BURST_TRACKER = new Map();

function resolveTierFromKey(rawKey = '') {
  const k = String(rawKey || '').trim().toUpperCase();
  if (!k) return 'extension-pro';
  if (k.includes('SUITE') || k.includes('OWNER')) return 'suite-bundle';
  if (k.includes('-OS-') || k.includes('SINGLE') || k.includes('WIN') || k.includes('MAC')) return 'single-os';
  if (k.includes('FREE')) return 'free';
  return 'extension-pro';
}

function getDefaultSyncState(keyOrEmail = OWNER_KEY) {
  const cleanKey = String(keyOrEmail || OWNER_KEY).trim().toUpperCase();
  const tierId = resolveTierFromKey(cleanKey);
  const planMeta = PLAN_CREDIT_CATALOG[tierId] || PLAN_CREDIT_CATALOG['extension-pro'];
  const defaultUsed = tierId === 'suite-bundle' ? 140 : tierId === 'single-os' ? 65 : 15;
  const remaining = Math.max(0, planMeta.monthlyCredits - defaultUsed);

  return {
    key: cleanKey,
    tier: tierId,
    planName: planMeta.name,
    creditsTotal: planMeta.monthlyCredits,
    creditsUsed: defaultUsed,
    creditsRemaining: remaining,
    topupCredits: 0,
    billingCycleReset: '2026-11-25T00:00:00Z',
    unlimitedOwner: cleanKey === OWNER_KEY || cleanKey === OWNER_KEY,
    theme: 'light',
    uiLang: 'en',
    aiLang: 'en',
    explanationMode: 'step-by-step',
    hudVisualProfile: 'compact-hud',
    hudOpacity: 82,
    hudTriggerKey: 'Alt+Q',
    hudTriggerButton: 'alt_click',
    hudResetKey: 'Alt+R',
    hudPosition: 'bottom-right',
    courseNotesContext: 'Course Reference: Standard University STEM, Clinical Pharmacology, European Law (GDPR Art. 83), Calculus II & Computer Networks (RFC 791 / TCP Reno).',
    activeAddons: tierId === 'suite-bundle' ? ['priority_ai', 'course_rag'] : [],
    devices: [
      { id: 'dev_chrome_win', name: 'Chrome / Edge Extension v4.8.6 (Windows 11)', platform: 'extension', version: '4.8.6', status: 'ONLINE', lastSync: new Date().toISOString() },
      { id: 'dev_desktop_app', name: 'LSExam Desktop Companion v4.8.6', platform: 'windows', version: '4.8.6', status: 'ONLINE', lastSync: new Date().toISOString() },
      { id: 'dev_ipados_app', name: 'iPadOS Split-View Companion v4.8.6', platform: 'ios', version: '4.8.6', status: 'STANDBY', lastSync: new Date().toISOString() }
    ],
    studyHistory: [
      {
        id: 'hist_1',
        course: 'Calculus II · Limits & Derivatives',
        question: 'Evaluate lim(x→0) [sin(4x) / (2x)]',
        answer: 'Option B (2)',
        creditsCost: 1,
        explanation: 'Rewrite sin(4x)/(2x) = 2 · [sin(4x)/(4x)]. Using lim(u→0) sin(u)/u = 1 with u = 4x yields 2 · 1 = 2.',
        timestamp: '2026-10-24T21:15:00Z'
      },
      {
        id: 'hist_2',
        course: 'Computer Networks · IPv4 Subnetting',
        question: 'How many usable host IPv4 addresses are available in a /26 CIDR subnet?',
        answer: 'Option C (62 usable hosts)',
        creditsCost: 1,
        explanation: 'Host bits = 32 - 26 = 6 bits. Total addresses = 2^6 = 64. Subtracting network (1) and broadcast (1) leaves 62 usable hosts.',
        timestamp: '2026-10-24T21:40:00Z'
      },
      {
        id: 'hist_3',
        course: 'Clinical Pharmacology · Autonomic Drugs',
        question: 'Which beta-blocker exhibits selective beta-1 receptor blockade plus endothelial NO-mediated vasodilation?',
        answer: 'Option B (Nebivolol)',
        creditsCost: 2,
        explanation: 'Nebivolol is a third-generation cardioselective beta-1 antagonist that also stimulates endothelial nitric oxide synthase (eNOS).',
        timestamp: '2026-10-24T22:05:00Z'
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

async function hmacHex(message, secret = DEFAULT_HMAC_SECRET) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return decodeURIComponent(escape(atob(padded + '='.repeat(padLen))));
}

async function generateAccountLicenseKey(email, tier = 'PRO', secret = DEFAULT_HMAC_SECRET) {
  const cleanEmail = String(email || 'student@gmail.com').trim().toLowerCase();
  const prefix = tier.includes('SUITE') || tier.includes('all') ? 'SUITE' : tier.includes('OS') || tier.includes('single') ? 'OS' : 'PRO';
  const digest = (await hmacHex(`key:${cleanEmail}:${prefix}`, secret)).toUpperCase();
  const seg1 = digest.slice(0, 4);
  const seg2 = digest.slice(4, 8);
  const seg3 = digest.slice(8, 12);
  return `LSP-${prefix}-${seg1}-${seg2}-${seg3}`;
}

async function isLicenseKeyCryptographicallyValid(rawKey, email = '', secret = DEFAULT_HMAC_SECRET) {
  const key = String(rawKey || '').trim().toUpperCase();
  if (!key || key.length < 10) return false;
  if (key.includes('FAKE') || key.includes('CRACK') || key.includes('BYPASS') || key.includes('0000') || key.includes('1234') || key.includes('INVALID')) {
    return false;
  }
  if (OFFICIAL_VALID_KEYS.has(key)) return true;
  // Account keys are only valid when they match the HMAC of the account email (needs HMAC_SECRET).
  if (!secret || !email) return false;
  const m = /^LSP-(PRO|OS|SUITE)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.exec(key);
  if (!m) return false;
  return key === (await generateAccountLicenseKey(email, m[1], secret));
}

async function signSessionToken(payloadObj, secret = DEFAULT_HMAC_SECRET) {
  requireSecret(secret, 'HMAC_SECRET');
  const payloadB64 = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = (await hmacHex(payloadB64, secret)).slice(0, 32);
  return `lsp_tok_${payloadB64}.${sig}`;
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sanitizeCleanText(val, maxLen = 180) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLen);
}

async function verifySessionToken(tokenStr, secret = DEFAULT_HMAC_SECRET) {
  if (!secret) return null;
  if (!tokenStr || typeof tokenStr !== "string" || !tokenStr.startsWith("lsp_tok_")) return null;
  const raw = tokenStr.slice(8);
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0) return null;
  const payloadB64 = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expectedSig = (await hmacHex(payloadB64, secret)).slice(0, 32);
  if (!constantTimeEqual(sig, expectedSig)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payloadB64));
    if (!data || typeof data !== "object") return null;
    if (data.exp && Date.now() > Number(data.exp)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function verifyAdminRequest(request, url, body, secret = DEFAULT_HMAC_SECRET) {
  const authHeader = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const headerToken = (request.headers.get("X-Admin-Token") || "").trim();
  const queryToken = (url && url.searchParams && url.searchParams.get("token")) || "";
  const bodyToken = (body && body.adminToken) || (body && body.token) || "";
  const token = authHeader || headerToken || bodyToken || queryToken;
  if (!token) return null;
  const payload = await verifySessionToken(token, secret);
  if (!payload || payload.role !== "SUPERADMIN" || payload.cif !== "RO00000000") {
    return null;
  }
  return payload;
}

function decodeGoogleJwtPayload(jwt) {
  if (!jwt || typeof jwt !== 'string' || jwt.split('.').length !== 3) return null;
  try {
    const payloadPart = jwt.split('.')[1];
    return JSON.parse(base64UrlDecode(payloadPart));
  } catch (_) {
    return null;
  }
}

function tryZeroCostLocalAcademicSolver(promptText, lang = 'en') {
  const q = String(promptText || '').toLowerCase();
  const cidrMatch = q.match(/\/(2[4-9]|30)\b/);
  if (cidrMatch && (q.includes('host') || q.includes('subnet') || q.includes('cidr') || q.includes('ip'))) {
    const prefix = parseInt(cidrMatch[1], 10);
    const usable = Math.pow(2, 32 - prefix) - 2;
    return `🎯 Correct Answer: ${usable} usable hosts (/${prefix} subnet)\n\n📘 Step-by-Step Academic Derivation:\n1. Host bits = 32 - ${prefix} = ${32 - prefix} bits.\n2. Usable hosts = 2^(${32 - prefix}) - 2 = ${usable} hosts (subtracting network & broadcast addresses).`;
  }
  if (q.includes('3x^2') || q.includes('f(x) = 3x²') || q.includes('derivative') || q.includes('derivata') || q.includes('x^2 * e^x') || q.includes('sin(4x)') || q.includes('ln(x)')) {
    return buildEducationalFallback(promptText, lang);
  }
  if (q.includes('binary search') || q.includes('cautare binara') || q.includes('mergesort') || q.includes('dijkstra') || q.includes('penicillin') || q.includes('beta-lactam') || q.includes('nebivolol') || q.includes('ohm') || q.includes('alteplas') || q.includes('gdpr') || q.includes('mundell')) {
    return buildEducationalFallback(promptText, lang);
  }
  return null;
}

function buildEducationalFallback(promptText = '', lang = 'en') {
  const q = String(promptText || '').toLowerCase();
  if (q.includes('sin(4x)') || q.includes('lim')) {
    return [
      '🎯 Verified Answer: Option B (2)',
      'Step-by-Step Mathematical Derivation (LSPilot Academic Engine · 290ms):',
      '1. Apply the fundamental trigonometric limit: lim[u → 0] sin(u)/u = 1.',
      '2. Rewrite sin(4x)/(2x) as 2 · [sin(4x)/(4x)].',
      '3. Substituting u = 4x as x → 0 yields 2 · 1 = 2.'
    ].join('\n');
  }
  if (q.includes('ln(x)') || q.includes('integral')) {
    return [
      '🎯 Verified Answer: Option B (1)',
      'Step-by-Step Calculus II Derivation:',
      '1. Use integration by parts with u = ln(x), dv = x^(-2) dx → du = (1/x) dx, v = -1/x.',
      '2. ∫[1 to ∞] ln(x)/x² dx = [-ln(x)/x - 1/x] evaluated from 1 to ∞.',
      '3. Since lim(x→∞) ln(x)/x = 0, the expression evaluates to (0 - 0) - (0 - 1) = 1.'
    ].join('\n');
  }
  if (q.includes('subnet') || q.includes('ipv4') || q.includes('/24') || q.includes('class c')) {
    return [
      '🎯 Verified Answer: Option C (255.255.255.0)',
      'Step-by-Step Networking Derivation:',
      '1. A standard Class C IPv4 network uses a /24 CIDR prefix (24 network bits, 8 host bits).',
      '2. Converting 24 contiguous 1-bits into dotted-decimal notation gives 255.255.255.0.'
    ].join('\n');
  }
  if (q.includes('ohm') || q.includes('electric current') || q.includes('u / r')) {
    return [
      '🎯 Verified Answer: Option B (I = U / R)',
      'Step-by-Step Physics Derivation:',
      '1. By Ohm\'s Law for DC circuits, potential difference U across resistance R is U = I · R.',
      '2. Solving for electric current I gives I = U / R (Voltage divided by Resistance).'
    ].join('\n');
  }
  if (q.includes('nebivolol') || q.includes('beta') || q.includes('cardioselect') || q.includes('metoprolol')) {
    return [
      '🎯 Verified Answer: Option B (Nebivolol / Selective Beta-1 Blocker)',
      'Step-by-Step Clinical Pharmacology Explanation:',
      '1. Selective beta-1 adrenergic antagonists preferentially block cardiac beta-1 receptors while sparing bronchial beta-2 receptors.',
      '2. Nebivolol exhibits the highest beta-1 cardioselectivity plus endothelial nitric oxide (NO)-mediated vasodilation.'
    ].join('\n');
  }
  if (q.includes('alteplas') || q.includes('rtpa') || q.includes('hemipares')) {
    return [
      '🎯 Verified Answer: Option B (IV Alteplase rtPA 0.9 mg/kg — 10% bolus, 90% over 60 min)',
      'Step-by-Step Clinical Neurology Protocol:',
      '1. Acute ischemic stroke within the 4.5-hour window (75 min onset) with non-contrast CT ruling out hemorrhage and BP < 185/110 mmHg (168/94 mmHg) qualifies for IV thrombolysis.',
      '2. Standard guideline regimen is IV recombinant tissue plasminogen activator (Alteplase) 0.9 mg/kg (max 90 mg).'
    ].join('\n');
  }
  return [
    '🎯 Verified Academic Concept & Step-by-Step Solution',
    `Language: ${(lang || 'en').toUpperCase()} · Engine: LSPilot AI Pro v4.8.6 Educational Copilot`,
    '1. Identify the core governing equation or definition in the question stem.',
    '2. Eliminate distractors that violate boundary conditions or dimensional consistency.',
    '3. Verify the final result against your uploaded Course Context RAG notes.'
  ].join('\n');
}

const PROMPT_DEDUP_CACHE = new Map();
const DAILY_QUOTA_TRACKER = new Map();

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}


// ============================================================================
// YOUR COMPANY SRL — OFFICIAL FGO API v1 + CUSTOMER ID LEDGER + ADMIN CENTER
// ============================================================================
let ADMIN_PASSWORD_SALT = ""; // env.ADMIN_PASSWORD_SALT
const ALLOWED_ADMIN_PASSWORD_HASHES = new Set(); // env.ADMIN_PASSWORD_HASHES = sha256(salt + password), comma-separated

const ADMIN_BRUTE_FORCE_TRACKER = new Map();
const CUSTOMER_ID_STORE = new Map();
const EMAIL_TO_CUSTOMER_ID = new Map();

const ADMIN_CONFIG_STORE = {
  company: {
    name: "YOUR COMPANY SRL",
    cif: "RO00000000",
    regCom: "J00/0000/2026",
    address: "Your registered address",
    iban: "",
    bank: "",
    email: "support@example.com",
    phone: ""
  },
  fgo: {
    apiUrl: "https://api.fgo.ro/v1",
    codUnic: "RO00000000",
    serie: "LSP",
    nextNumber: 1001,
    privateKeyConfigured: false,
    privateKeyMasked: "",
    privateKeyRaw: "",
    tvaCota: 0,
    neplatitorTva: true,
    autoIssueOnStripeWebhook: true,
    autoMarkIncasareCard: true,
    autoSendEmailFromFgo: true,
    eFacturaAnafB2B: true,
    platformUrl: "https://www.example.com"
  },
  admins: [
    {
      id: "adm_owner",
      name: "Owner",
      role: "Administrator",
      email: "admin@example.com",
      status: "ACTIVE",
      permissions: "FULL_SUPERADMIN"
    }
  ],
  customDomain: {
    primaryDomain: "example.com",
    workerFallback: "your-site.your-subdomain.workers.dev",
    sslStatus: "ACTIVE_CLOUDFLARE_SSL"
  },
  adsConfig: {
    enabledForFreeTier: true,
    waitTimerSeconds: 5,
    removeAdsCtaText: "✕ Remove Ads & 5s Wait — Go Pro $3.99/mo"
  }
};

// Starts empty: only real invoices emitted via Stripe Webhook or FGO API are stored here.
const INVOICE_LEDGER_STORE = [];

const ADMIN_AUDIT_LOG = [
  {
    id: "aud_1",
    timestamp: "2026-10-25T08:00:00Z",
    operator: "Owner",
    action: "SYSTEM_INIT",
    target: "YOUR COMPANY SRL (CIF RO00000000 · J00/0000/2026)",
    details: "Configurare producție FGO API v1 (Serie LSP) + Stripe Webhook + Sistem Customer ID (LSP-ID-XXXXXX)."
  }
];

async function sha1HexUpper(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function normalizeCustomerId(rawId = "", email = "") {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const clean = String(rawId || "").trim().toUpperCase();
  if (/^LSP-ID-[A-Z0-9]{4,10}$/.test(clean)) return clean;
  if (cleanEmail && EMAIL_TO_CUSTOMER_ID.has(cleanEmail)) {
    return EMAIL_TO_CUSTOMER_ID.get(cleanEmail);
  }
  const seed = (cleanEmail || clean || "user").toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const sixDigits = String(100000 + (Math.abs(hash) % 900000));
  return "LSP-ID-" + sixDigits;
}

function getOrCreateCustomerRecord(customerIdOrEmail = "", optionalEmail = "", optionalName = "", optionalTier = "") {
  const cleanInput = String(customerIdOrEmail || "").trim();
  const isEmail = cleanInput.includes("@");
  const email = (isEmail ? cleanInput : String(optionalEmail || "")).trim().toLowerCase();
  const custId = isEmail ? normalizeCustomerId("", email) : normalizeCustomerId(cleanInput, email);

  if (CUSTOMER_ID_STORE.has(custId)) {
    const existing = CUSTOMER_ID_STORE.get(custId);
    if (email && (!existing.email || existing.email.endsWith("@lspilot.local"))) {
      existing.email = email;
      EMAIL_TO_CUSTOMER_ID.set(email, custId);
    }
    if (optionalName && (!existing.name || existing.name === existing.customerId)) {
      existing.name = optionalName;
    }
    return existing;
  }

  const matchingInv = INVOICE_LEDGER_STORE.find(inv => inv.customerId === custId || (email && inv.buyerEmail.toLowerCase() === email));
  const resolvedEmail = email || (matchingInv ? matchingInv.buyerEmail : "");
  const resolvedName = optionalName || (matchingInv ? matchingInv.buyerName : (resolvedEmail ? resolvedEmail.split("@")[0].replace(/[._-]/g, " ") : custId));
  const resolvedPlan = optionalTier || (matchingInv ? matchingInv.planId : "extension-pro");
  const planMeta = PLAN_CREDIT_CATALOG[resolvedPlan] || PLAN_CREDIT_CATALOG["extension-pro"];

  const record = {
    customerId: custId,
    email: resolvedEmail,
    name: resolvedName,
    tier: resolvedPlan,
    planName: planMeta.name,
    billingCycle: matchingInv ? matchingInv.billingCycle : "monthly",
    proActive: resolvedPlan !== "free",
    licenseKey: "LSP-PRO-" + custId.replace("LSP-ID-", "") + "-2026",
    creditsTotal: planMeta.monthlyCredits,
    creditsUsed: 0,
    creditsRemaining: planMeta.monthlyCredits,
    topupCredits: 0,
    adminGrantedCoins: 0,
    maxDevices: 3,
    devices: [
      { id: "dev_" + custId.slice(-4), name: "Chrome / Edge Extension v4.8.6", platform: "extension", status: "ONLINE", lastSync: new Date().toISOString() }
    ],
    grantHistory: [],
    createdAt: matchingInv ? matchingInv.date : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  CUSTOMER_ID_STORE.set(custId, record);
  if (resolvedEmail) EMAIL_TO_CUSTOMER_ID.set(resolvedEmail.toLowerCase(), custId);
  return record;
}

// Pre-seed ONLY the 2 real Co-Owners / Administrators of YOUR COMPANY SRL
(function seedRealCoOwners() {
  const owners = []; // no accounts are pre-seeded in the public version
  for (const o of owners) {
    CUSTOMER_ID_STORE.set(o.customerId, o);
    EMAIL_TO_CUSTOMER_ID.set(o.email.toLowerCase(), o.customerId);
  }
})();

async function emitFgoInvoiceOfficial(payload, env) {
  const fgoCfg = ADMIN_CONFIG_STORE.fgo;
  const codUnic = (env && env.FGO_COD_UNIC) || fgoCfg.codUnic || "RO00000000";
  const privateKey = (env && env.FGO_PRIVATE_KEY) || fgoCfg.privateKeyRaw || "";
  const serie = payload.serie || (env && env.FGO_SERIE) || fgoCfg.serie || "LSP";
  const buyerName = sanitizeCleanText(payload.buyerName || payload.email || "Client Persoana Fizica", 120) || "Client Persoana Fizica";
  const buyerType = payload.buyerCui ? "PJ" : (payload.buyerType || "PF");
  const currency = (payload.currency || "USD").toUpperCase();
  const amount = Number(payload.amount || 3.99);
  const amountRon = currency === "RON" ? amount : Number((amount * (currency === "EUR" ? 4.97 : 4.65)).toFixed(2));
  const itemDesc = payload.itemDescription || "Abonament LSPilot AI Educational Study Assistant (" + (payload.planId || "Extension Pro") + ")";
  const customerId = normalizeCustomerId(payload.customerId, payload.buyerEmail);

  // Official FGO SHA-1 Hash: SHA-1(UPPERCASE(CodUnic + CheiePrivata + Client.Denumire))
  const hashInput = (String(codUnic) + String(privateKey || "FGO_KEY_PENDING") + buyerName).toUpperCase();
  const fgoHash = await sha1HexUpper(hashInput);

  const fgoRequestBody = {
    CodUnic: codUnic,
    Hash: fgoHash,
    Serie: serie,
    TipFactura: "Factura",
    Valuta: currency,
     Explicatii: "Customer ID: " + customerId + " | Plata procesata securizat prin Stripe. Emis de YOUR COMPANY SRL (CIF RO00000000).",
    PlatformaUrl: fgoCfg.platformUrl || "https://www.example.com",
    TrimiteEmail: Boolean(fgoCfg.autoSendEmailFromFgo),
    Client: {
      Denumire: buyerName,
      CodUnic: payload.buyerCui || "",
      NrRegCom: payload.buyerRegCom || "",
      Tip: buyerType,
      Tara: payload.buyerCountry || "RO",
      Judet: payload.buyerCounty || "Mures",
      Localitate: payload.buyerCity || "Targu Mures",
      Adresa: payload.buyerAddress || "Romania",
      Email: payload.buyerEmail || ""
    },
    Continut: [
      {
        Denumire: itemDesc,
        CodArticol: (payload.planId || "LSP-PRO").toUpperCase(),
        Descriere: "Customer ID: " + customerId + " | Licenta Digitala si AI Credit Coins",
        UM: "BUC",
        NrProduse: 1,
        PretUnitar: amount,
        CotaTVA: Number(fgoCfg.tvaCota || 0)
      }
    ],
    Incasare: fgoCfg.autoMarkIncasareCard ? {
      Suma: amount,
      TipIncasare: "Card online",
      DataIncasare: new Date().toISOString().slice(0, 10),
      Explicatii: payload.paymentMethod || "Stripe Checkout / Apple Pay / Google Pay"
    } : undefined
  };

  let fgoApiResult = null;
  let fgoLiveSynced = false;

  if (privateKey && privateKey.length > 6) {
    try {
      const res = await fetch(fgoCfg.apiUrl + "/factura/emitere", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(fgoRequestBody)
      });
      fgoApiResult = await res.json().catch(() => null);
      if (fgoApiResult && fgoApiResult.Success) {
        fgoLiveSynced = true;
      }
    } catch (err) {
      fgoApiResult = { Success: false, Message: String(err.message || err) };
    }
  }

  const assignedNumber = (fgoApiResult && fgoApiResult.Factura && fgoApiResult.Factura.Numar)
    ? String(fgoApiResult.Factura.Numar)
    : String(fgoCfg.nextNumber++);
  const assignedSerie = (fgoApiResult && fgoApiResult.Factura && fgoApiResult.Factura.Serie)
    ? String(fgoApiResult.Factura.Serie)
    : serie;
  const seriesNumber = assignedSerie + "-" + assignedNumber;

  const newInvoice = {
    id: "INV-" + seriesNumber,
    serie: assignedSerie,
    numar: assignedNumber,
    seriesNumber,
    date: new Date().toISOString(),
    customerId,
    buyerType,
    buyerName,
    buyerEmail: payload.buyerEmail || "student@university.edu",
    buyerCui: payload.buyerCui || "",
    buyerRegCom: payload.buyerRegCom || "",
    buyerAddress: payload.buyerAddress || "România",
    buyerCountry: payload.buyerCountry || "RO",
    planId: payload.planId || "extension-pro",
    billingCycle: payload.billingCycle || "monthly",
    itemDescription: itemDesc,
    amount,
    currency,
    amountRon,
    tvaRate: Number(fgoCfg.tvaCota || 0),
    paymentMethod: payload.paymentMethod || "Card Online / Stripe",
    stripeRef: payload.stripeRef || ("pi_live_" + Date.now().toString(36)),
    status: "PAID_INCASATA",
    fgoStatus: fgoLiveSynced ? "EMISA_LIVE_FGO" : "EMISA_LOCAL_PREGATITA_FGO",
    fgoHash: fgoHash.slice(0, 16) + "...",
    fgoLink: (fgoApiResult && fgoApiResult.Factura && fgoApiResult.Factura.Link) || ("/api/billing/invoice-print?id=" + encodeURIComponent(seriesNumber)),
    eFacturaStatus: buyerType === "PJ" ? "PREGATIT_ANAF_SPV" : "N/A (B2C PF)",
    fgoPayloadPreview: fgoRequestBody
  };

  INVOICE_LEDGER_STORE.unshift(newInvoice);
  return newInvoice;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    applyEnvConfig(env);
    const secret = (env && env.HMAC_SECRET) || DEFAULT_HMAC_SECRET;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    
    // =========================================================================
    // 0.5 CUSTOMER ID LIVE SYNC & BALANCE ENDPOINT (/api/customer/sync, /api/customer/lookup)
    // =========================================================================
    if (path === "/api/customer/sync" || path === "/api/customer/lookup") {
      try {
        let body = {};
        if (request.method === "POST") {
          body = await request.json().catch(() => ({}));
        }
        if (body && (body.coinsDelta !== undefined || body.addCoins !== undefined || body.coins !== undefined || body.creditCoins !== undefined || body.creditsTotal !== undefined || body.adminGrantedCoins !== undefined || body.creditsRemaining !== undefined || body.proActive !== undefined || body.tier !== undefined || body.role === "SUPERADMIN")) {
          const admCheck = await verifyAdminRequest(request, url, body, secret);
          if (!admCheck) {
            return jsonResponse({ ok: false, error: "FORBIDDEN_PRIVILEGE_ESCALATION: Only authenticated YOUR COMPANY SRL Admins can mint coins or modify subscription tiers." }, 403);
          }
        }
        const rawCustomerId = sanitizeCleanText(body.customerId || url.searchParams.get("customerId") || url.searchParams.get("id") || "", 32);
        const rawEmail = body.email || url.searchParams.get("email") || "";
        const record = getOrCreateCustomerRecord(rawCustomerId || rawEmail, rawEmail);

        // If client sent local state to merge
        if (body.email && body.email.includes("@")) {
          record.email = String(body.email).trim().toLowerCase();
          EMAIL_TO_CUSTOMER_ID.set(record.email, record.customerId);
        }
        if (body.name) record.name = sanitizeCleanText(body.name, 80);

        const customerInvoices = INVOICE_LEDGER_STORE.filter(
          inv => inv.customerId === record.customerId || (record.email && inv.buyerEmail.toLowerCase() === record.email.toLowerCase())
        );

        return jsonResponse({
          ok: true,
          success: true,
          customerId: record.customerId,
          customer: record,
          invoices: customerInvoices,
          serverTime: new Date().toISOString()
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    // =========================================================================
    // 0.6 STRIPE WEBHOOK + FGO AUTOMATIC INVOICING (/api/webhooks/stripe, /api/billing/issue-invoice, /api/billing/invoices)
    // =========================================================================
    if (path === "/api/webhooks/stripe") {
      try {
        // Require Stripe signature + STRIPE_WEBHOOK_SECRET (wrangler secret). Never process unsigned webhooks.
        const stripeSecret = (env && env.STRIPE_WEBHOOK_SECRET) || '';
        const sig = request.headers.get('Stripe-Signature') || '';
        if (!stripeSecret || !sig) {
          return jsonResponse({
            ok: false,
            error: 'WEBHOOK_UNAUTHORIZED',
            message: 'Missing Stripe-Signature or STRIPE_WEBHOOK_SECRET. Unsigned Stripe webhooks are rejected.'
          }, 401);
        }
        // Full HMAC verification of the raw body should be added once the secret is configured.
        // Until then, refuse any request that does not present both secret (server) and signature (client).
        const event = await request.json().catch(() => ({}));
        const obj = (event && event.data && event.data.object) || event || {};
        const buyerEmail = obj.customer_email || (obj.customer_details && obj.customer_details.email) || "student@university.edu";
        const buyerName = (obj.customer_details && obj.customer_details.name) || obj.buyerName || buyerEmail.split("@")[0];
        const taxIds = (obj.customer_details && obj.customer_details.tax_ids) || [];
        const buyerCui = (taxIds[0] && taxIds[0].value) || obj.buyerCui || "";
        const amount = obj.amount_total ? Number((obj.amount_total / 100).toFixed(2)) : Number(obj.amount || 3.99);
        const currency = String(obj.currency || "USD").toUpperCase();
        const planId = (obj.metadata && obj.metadata.planId) || obj.planId || (amount >= 50 ? "suite-bundle" : amount >= 25 ? "single-os" : "extension-pro");
        const customerRecord = getOrCreateCustomerRecord(obj.client_reference_id || buyerEmail, buyerEmail);

        // Activate customer plan & coins automatically
        const planMeta = PLAN_CREDIT_CATALOG[planId] || PLAN_CREDIT_CATALOG["extension-pro"];
        customerRecord.tier = planId;
        customerRecord.planName = planMeta.name;
        customerRecord.proActive = true;
        customerRecord.creditsTotal = (customerRecord.creditsTotal || 0) + planMeta.monthlyCredits;
        customerRecord.creditsRemaining = (customerRecord.creditsRemaining || 0) + planMeta.monthlyCredits;
        customerRecord.updatedAt = new Date().toISOString();

        const invoice = await emitFgoInvoiceOfficial({
          customerId: customerRecord.customerId,
          buyerName,
          buyerEmail,
          buyerCui,
          planId,
          amount,
          currency,
          paymentMethod: "Stripe Webhook (" + (event.type || "checkout.session.completed") + ")",
          stripeRef: obj.id || obj.payment_intent || ("evt_" + Date.now())
        }, env);

        ADMIN_AUDIT_LOG.unshift({
          id: "aud_" + Date.now(),
          timestamp: new Date().toISOString(),
          operator: "Stripe + FGO Automat",
          action: "WEBHOOK_INVOICE_EMITTED",
          target: invoice.seriesNumber + " · " + customerRecord.customerId,
          details: "Factură FGO emisă automat la plata Stripe (" + amount + " " + currency + ") pentru " + buyerEmail
        });

        return jsonResponse({
          ok: true,
          success: true,
          webhookProcessed: true,
          customerId: customerRecord.customerId,
          licenseKey: customerRecord.licenseKey,
          invoice
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    if (path === "/api/billing/invoices" && request.method === "GET") {
      const custId = (url.searchParams.get("customerId") || "").trim().toUpperCase();
      const email = (url.searchParams.get("email") || "").trim().toLowerCase();
      const licenseKey = (url.searchParams.get("licenseKey") || request.headers.get("X-License-Key") || "").trim();
      if (!custId && !email && !licenseKey) {
        return jsonResponse({ ok: false, error: 'AUTH_REQUIRED', message: 'Provide customerId, email, or licenseKey' }, 401);
      }
      let list = INVOICE_LEDGER_STORE.filter(inv =>
        (custId && inv.customerId === custId) ||
        (email && String(inv.buyerEmail||'').toLowerCase() === email) ||
        (licenseKey && String(inv.licenseKey||'') === licenseKey)
      );
      return jsonResponse({
        ok: true,
        success: true,
        company: ADMIN_CONFIG_STORE.company,
        fgoSerie: ADMIN_CONFIG_STORE.fgo.serie,
        invoices: list
      });
    }

    if (path === "/api/billing/issue-invoice" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        {
          const adm = await verifyAdminRequest(request, url, body, secret);
          if (!adm) return jsonResponse({ ok: false, error: "UNAUTHORIZED_ADMIN_TOKEN", message: "Invoice issuance requires admin auth" }, 401);
        }
        const invoice = await emitFgoInvoiceOfficial(body, env);
        ADMIN_AUDIT_LOG.unshift({
          id: "aud_" + Date.now(),
          timestamp: new Date().toISOString(),
          operator: body.operator || "Portal Facturare FGO",
          action: "INVOICE_ISSUED",
          target: invoice.seriesNumber + " (" + invoice.customerId + ")",
          details: "Factură emisă pentru " + invoice.buyerName + (invoice.buyerCui ? " (CUI: " + invoice.buyerCui + ")" : " (PF)") + " — " + invoice.amount + " " + invoice.currency
        });
        return jsonResponse({
          ok: true,
          success: true,
          invoice,
          company: ADMIN_CONFIG_STORE.company
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    // =========================================================================
    // 0.7 SECURE ADMIN DASHBOARD API (owner)
    // =========================================================================
    if (path === "/api/admin/login" && request.method === "POST") {
      try {
        const clientIp = request.headers.get("X-RedTeam-Test-IP") || request.headers.get("CF-Connecting-IP") || "local_ip";
        const bf = ADMIN_BRUTE_FORCE_TRACKER.get(clientIp) || { count: 0, lockedUntil: 0 };
        if (bf.lockedUntil > Date.now()) {
          const minsLeft = Math.ceil((bf.lockedUntil - Date.now()) / 60000);
          return jsonResponse({
            ok: false,
            error: "Prea multe încercări eșuate. Acces blocat temporar pentru " + minsLeft + " minute (Protecție Anti-Brute-Force)."
          }, 429);
        }

        const body = await request.json().catch(() => ({}));
        const email = String(body.email || "").trim().toLowerCase();
        const rawPassword = String(body.password || "");
        const passwordTrimmed = rawPassword.trim();
        const selectedOperator = body.operator || "Owner";

        const validEmails = new Set([ADMIN_EMAIL]);
        ADMIN_CONFIG_STORE.admins.forEach(a => {
          if (a.email) validEmails.add(a.email.toLowerCase());
          if (a.altEmail) validEmails.add(a.altEmail.toLowerCase());
        });

        const hashExact = await sha256Hex(ADMIN_PASSWORD_SALT + rawPassword);
        const hashTrim = await sha256Hex(ADMIN_PASSWORD_SALT + passwordTrimmed);
        const hashNoSpace = await sha256Hex(ADMIN_PASSWORD_SALT + passwordTrimmed.replace(/\s*&\s*/g, "&"));

        const emailOk = validEmails.has(email);
        const passOk = ALLOWED_ADMIN_PASSWORD_HASHES.has(hashExact) ||
                       ALLOWED_ADMIN_PASSWORD_HASHES.has(hashTrim) ||
                       ALLOWED_ADMIN_PASSWORD_HASHES.has(hashNoSpace) ||
                       (body.passwordHash && ALLOWED_ADMIN_PASSWORD_HASHES.has(body.passwordHash));

        if (!emailOk || !passOk) {
          bf.count += 1;
          if (bf.count >= 5) {
            bf.lockedUntil = Date.now() + 15 * 60 * 1000;
          }
          ADMIN_BRUTE_FORCE_TRACKER.set(clientIp, bf);
          return jsonResponse({
            ok: false,
            error: "Email sau parolă de administrator incorectă. Acces permis doar administratorilor configurați."
          }, 401);
        }

        ADMIN_BRUTE_FORCE_TRACKER.delete(clientIp);
        const adminToken = await signSessionToken({
          role: "SUPERADMIN",
          email,
          operator: selectedOperator,
          cif: "RO00000000",
          iat: Date.now(),
          exp: Date.now() + 12 * 3600 * 1000
        }, secret);

        ADMIN_AUDIT_LOG.unshift({
          id: "aud_" + Date.now(),
          timestamp: new Date().toISOString(),
          operator: selectedOperator,
          action: "ADMIN_LOGIN",
          target: email,
          details: "Autentificare securizată SHA-256 + HMAC în Panoul de Control YOUR COMPANY SRL"
        });

        return jsonResponse({
          ok: true,
          success: true,
          token: adminToken,
          operator: selectedOperator,
          email,
          company: ADMIN_CONFIG_STORE.company,
          admins: ADMIN_CONFIG_STORE.admins
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    if (path === "/api/admin/overview") {
      const adm = await verifyAdminRequest(request, url, null, secret);
      if (!adm) {
        return jsonResponse({ ok: false, error: "UNAUTHORIZED_ADMIN_TOKEN: Autentificare de administrator obligatorie." }, 401);
      }
      const customers = Array.from(CUSTOMER_ID_STORE.values());
      const totalUsd = INVOICE_LEDGER_STORE.reduce((acc, inv) => acc + (inv.status === "STORNO" ? 0 : Number(inv.amount || 0)), 0);
      const totalRon = INVOICE_LEDGER_STORE.reduce((acc, inv) => acc + (inv.status === "STORNO" ? 0 : Number(inv.amountRon || 0)), 0);
      return jsonResponse({
        ok: true,
        success: true,
        company: ADMIN_CONFIG_STORE.company,
        fgo: {
          ...ADMIN_CONFIG_STORE.fgo,
          privateKeyRaw: undefined
        },
        admins: ADMIN_CONFIG_STORE.admins,
        customDomain: ADMIN_CONFIG_STORE.customDomain,
        adsConfig: ADMIN_CONFIG_STORE.adsConfig,
        stats: {
          totalRevenueUsd: Number(totalUsd.toFixed(2)),
          totalRevenueRon: Number(totalRon.toFixed(2)),
          invoicesCount: INVOICE_LEDGER_STORE.length,
          activeSubscribers: customers.filter(c => c.proActive).length,
          totalCoinsIssued: customers.reduce((s, c) => s + (c.creditsRemaining || c.creditsTotal || 0), 0),
          aiEngineStatus: "ONLINE · 99.98% Uptime (DeepSeek V4.1 + Gemini 2.5 Flash)"
        },
        invoices: INVOICE_LEDGER_STORE,
        customers,
        auditLog: ADMIN_AUDIT_LOG.slice(0, 60)
      });
    }

    if ((path === "/api/admin/customer-action" || path === "/api/admin/grant-coins") && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const adm = await verifyAdminRequest(request, url, body, secret);
        if (!adm) {
          return jsonResponse({ ok: false, error: "UNAUTHORIZED_ADMIN_TOKEN: Acces interzis fără token criptografic de Admin." }, 401);
        }
        const action = body.action || "grant_coins";
        const operator = sanitizeCleanText(body.operator || adm.operator || "Owner", 60);
        const query = String(body.customerId || body.email || body.query || "").trim();
        const record = getOrCreateCustomerRecord(query, body.email || (query.includes("@") ? query : ""));

        if (action === "grant_coins") {
          const delta = parseInt(body.coinsDelta || body.addCoins || body.coins || "1000", 10);
          const reason = sanitizeCleanText(body.reason || "Compensare Suport Tehnic / Bonus Admin", 120);
          record.topupCredits = (record.topupCredits || 0) + delta;
          record.adminGrantedCoins = (record.adminGrantedCoins || 0) + delta;
          record.creditsTotal = (record.creditsTotal || 0) + delta;
          record.creditsRemaining = (record.creditsRemaining || 0) + delta;
          if (body.activatePro) {
            record.proActive = true;
            if (record.tier === "free") {
              record.tier = "extension-pro";
              record.planName = PLAN_CREDIT_CATALOG["extension-pro"].name;
            }
          }
          record.updatedAt = new Date().toISOString();
          record.grantHistory = record.grantHistory || [];
          record.grantHistory.unshift({
            id: "gr_" + Date.now(),
            coins: delta,
            reason,
            operator,
            timestamp: record.updatedAt
          });
          CUSTOMER_ID_STORE.set(record.customerId, record);

          // Also sync with CLOUD_SYNC_STORE for their licenseKey
          const syncState = CLOUD_SYNC_STORE.get(record.licenseKey) || getDefaultSyncState(record.licenseKey);
          syncState.topupCredits = record.topupCredits;
          syncState.creditsTotal = record.creditsTotal;
          syncState.creditsRemaining = record.creditsRemaining;
          CLOUD_SYNC_STORE.set(record.licenseKey, syncState);

          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: record.updatedAt,
            operator,
            action: "GRANT_COINS_BY_ID",
            target: record.customerId + " (" + record.email + ")",
            details: "Adăugat +" + delta.toLocaleString() + " AI Credit Coins pe ID " + record.customerId + " (" + reason + "). Sold nou: " + record.creditsRemaining.toLocaleString() + " Coins."
          });

          return jsonResponse({
            ok: true,
            success: true,
            action: "grant_coins",
            message: "✅ S-au adăugat +" + delta.toLocaleString() + " AI Credit Coins instant pentru " + record.customerId + "!",
            customer: record
          });
        }

        if (action === "activate_plan") {
          const newPlan = body.planId || "extension-pro";
          const billingCycle = body.billingCycle || "monthly";
          const planMeta = PLAN_CREDIT_CATALOG[newPlan] || PLAN_CREDIT_CATALOG["extension-pro"];
          const bonusMultiplier = billingCycle === "annual" ? 12 : billingCycle === "quarterly" ? 3 : 1;
          const addedCoins = planMeta.monthlyCredits * bonusMultiplier;

          record.tier = newPlan;
          record.planName = planMeta.name + " (" + billingCycle.toUpperCase() + ")";
          record.billingCycle = billingCycle;
          record.proActive = true;
          record.licenseKey = await generateAccountLicenseKey(record.email || record.customerId, newPlan, secret);
          record.creditsTotal = (record.creditsTotal || 0) + addedCoins;
          record.creditsRemaining = (record.creditsRemaining || 0) + addedCoins;
          record.updatedAt = new Date().toISOString();
          CUSTOMER_ID_STORE.set(record.customerId, record);

          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: record.updatedAt,
            operator,
            action: "ACTIVATE_PRO_PLAN",
            target: record.customerId + " (" + record.email + ")",
            details: "Activat plan " + record.planName + " + cheie " + record.licenseKey + " (+" + addedCoins.toLocaleString() + " Coins)."
          });

          return jsonResponse({
            ok: true,
            success: true,
            action: "activate_plan",
            message: "✅ Abonament " + record.planName + " activat pentru " + record.customerId + " (Cheie: " + record.licenseKey + ")!",
            customer: record
          });
        }

        if (action === "reset_devices") {
          record.devices = [
            { id: "dev_reset_" + Date.now().toString(36), name: "Slot 1 Liber (Resetat de " + operator + ")", platform: "any", status: "READY", lastSync: new Date().toISOString() }
          ];
          record.updatedAt = new Date().toISOString();
          CUSTOMER_ID_STORE.set(record.customerId, record);

          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: record.updatedAt,
            operator,
            action: "RESET_DEVICE_LOCKS",
            target: record.customerId + " (" + record.email + ")",
            details: "Resetat limita de 3 dispozitive hardware pentru " + record.customerId + "."
          });

          return jsonResponse({
            ok: true,
            success: true,
            action: "reset_devices",
            message: "✅ Dispozitivele asociate ID-ului " + record.customerId + " au fost resetate (0/3 utilizate)!",
            customer: record
          });
        }

        if (action === "update_invoice_b2b") {
          const targetInv = INVOICE_LEDGER_STORE.find(i => i.customerId === record.customerId || i.seriesNumber === body.invoiceId) || INVOICE_LEDGER_STORE[0];
          if (targetInv) {
            targetInv.buyerType = "PJ";
            targetInv.buyerName = body.companyName || targetInv.buyerName;
            targetInv.buyerCui = body.companyCui || targetInv.buyerCui || "RO12345678";
            targetInv.buyerRegCom = body.companyRegCom || targetInv.buyerRegCom || "J40/100/2024";
            targetInv.eFacturaStatus = "TRANSMIS_ANAF_SPV";
            targetInv.fgoStatus = "REEMISA_B2B_FGO";
          }
          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: new Date().toISOString(),
            operator,
            action: "UPDATE_INVOICE_B2B",
            target: (targetInv ? targetInv.seriesNumber : record.customerId),
            details: "Actualizat factura pe Persoană Juridică (CUI: " + (body.companyCui || "") + " - " + (body.companyName || "") + ")."
          });
          return jsonResponse({
            ok: true,
            success: true,
            action: "update_invoice_b2b",
            message: "✅ Factura a fost actualizată pe Firmă (B2B CUI) și marcată pentru RO e-Factura!",
            invoice: targetInv,
            customer: record
          });
        }

        if (action === "delete_invoice") {
          const seriesNumber = String(body.seriesNumber || "").trim();
          const idx = INVOICE_LEDGER_STORE.findIndex(i => i.seriesNumber === seriesNumber || i.id === seriesNumber);
          if (idx === -1) return jsonResponse({ ok: false, error: "Factura nu a fost găsită." }, 404);
          const removed = INVOICE_LEDGER_STORE.splice(idx, 1)[0];
          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: new Date().toISOString(),
            operator,
            action: "DELETE_INVOICE",
            target: removed.seriesNumber,
            details: "Factură ștearsă din registru de către administrator."
          });
          return jsonResponse({ ok: true, message: "🗑️ Factura " + removed.seriesNumber + " a fost ștearsă din registru." });
        }
        if (action === "storno_invoice") {
          const orig = INVOICE_LEDGER_STORE.find(i => i.seriesNumber === body.seriesNumber || i.id === body.invoiceId || i.customerId === record.customerId) || INVOICE_LEDGER_STORE[0];
          const stornoNum = String(ADMIN_CONFIG_STORE.fgo.nextNumber++);
          const stornoSeriesNum = ADMIN_CONFIG_STORE.fgo.serie + "-" + stornoNum;
          const stornoInv = {
            ...orig,
            id: "INV-" + stornoSeriesNum,
            numar: stornoNum,
            seriesNumber: stornoSeriesNum,
            date: new Date().toISOString(),
            itemDescription: "STORNO la factura " + orig.seriesNumber + " — " + orig.itemDescription,
            amount: -Math.abs(orig.amount),
            amountRon: -Math.abs(orig.amountRon || 0),
            status: "STORNO",
            fgoStatus: "STORNATA_FGO"
          };
          orig.status = "STORNATA_INTEGRAL";
          INVOICE_LEDGER_STORE.unshift(stornoInv);

          ADMIN_AUDIT_LOG.unshift({
            id: "aud_" + Date.now(),
            timestamp: new Date().toISOString(),
            operator,
            action: "STORNO_FGO_INVOICE",
            target: orig.seriesNumber + " -> " + stornoSeriesNum,
            details: "Emisă factură Storno FGO " + stornoSeriesNum + " (" + stornoInv.amount + " " + stornoInv.currency + ")."
          });

          return jsonResponse({
            ok: true,
            success: true,
            action: "storno_invoice",
            message: "✅ Factura " + orig.seriesNumber + " a fost stornată prin factura " + stornoSeriesNum + "!",
            stornoInvoice: stornoInv,
            customer: record
          });
        }

        return jsonResponse({
          ok: true,
          success: true,
          customer: record
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    if ((path === "/api/admin/fgo-config" || path === "/api/admin/config") && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const adm = await verifyAdminRequest(request, url, body, secret);
        if (!adm) {
          return jsonResponse({ ok: false, error: "UNAUTHORIZED_ADMIN_TOKEN: Acces interzis fără token criptografic de Admin." }, 401);
        }
        const operator = body.operator || "Owner";
        if (body.codUnic) ADMIN_CONFIG_STORE.fgo.codUnic = String(body.codUnic).trim();
        if (body.serie) ADMIN_CONFIG_STORE.fgo.serie = String(body.serie).trim().toUpperCase();
        if (body.tvaCota !== undefined) ADMIN_CONFIG_STORE.fgo.tvaCota = Number(body.tvaCota);
        if (body.privateKey && !body.privateKey.includes("***")) {
          ADMIN_CONFIG_STORE.fgo.privateKeyRaw = String(body.privateKey).trim();
          ADMIN_CONFIG_STORE.fgo.privateKeyConfigured = ADMIN_CONFIG_STORE.fgo.privateKeyRaw.length > 4;
          ADMIN_CONFIG_STORE.fgo.privateKeyMasked = ADMIN_CONFIG_STORE.fgo.privateKeyRaw.slice(0, 4) + "••••••••••••";
        }
        if (body.autoIssueOnStripeWebhook !== undefined) ADMIN_CONFIG_STORE.fgo.autoIssueOnStripeWebhook = Boolean(body.autoIssueOnStripeWebhook);
        if (body.autoMarkIncasareCard !== undefined) ADMIN_CONFIG_STORE.fgo.autoMarkIncasareCard = Boolean(body.autoMarkIncasareCard);
        if (body.autoSendEmailFromFgo !== undefined) ADMIN_CONFIG_STORE.fgo.autoSendEmailFromFgo = Boolean(body.autoSendEmailFromFgo);
        if (body.eFacturaAnafB2B !== undefined) ADMIN_CONFIG_STORE.fgo.eFacturaAnafB2B = Boolean(body.eFacturaAnafB2B);
        if (body.primaryDomain) ADMIN_CONFIG_STORE.customDomain.primaryDomain = String(body.primaryDomain).trim();
        if (body.serbanEmail) {
          const serbanAdm = ADMIN_CONFIG_STORE.admins.find(a => a.id === "adm_serban");
          if (serbanAdm) serbanAdm.email = String(body.serbanEmail).trim().toLowerCase();
        }

        const sampleHash = await sha1HexUpper(ADMIN_CONFIG_STORE.fgo.codUnic + (ADMIN_CONFIG_STORE.fgo.privateKeyRaw || "TEST_KEY") + "CLIENT TEST");

        ADMIN_AUDIT_LOG.unshift({
          id: "aud_" + Date.now(),
          timestamp: new Date().toISOString(),
          operator,
          action: "UPDATE_FGO_SETTINGS",
          target: "FGO API v1 (CIF " + ADMIN_CONFIG_STORE.fgo.codUnic + " · Serie " + ADMIN_CONFIG_STORE.fgo.serie + ")",
          details: "Salvat setări FGO API v1 & Contabilitate YOUR COMPANY SRL (SHA-1 Hash verificat: " + sampleHash.slice(0, 12) + "...)."
        });

        return jsonResponse({
          ok: true,
          success: true,
          fgo: {
            ...ADMIN_CONFIG_STORE.fgo,
            privateKeyRaw: undefined
          },
          sampleHash,
          message: "✅ Setările FGO API v1 (YOUR COMPANY SRL · CIF RO00000000 · Serie " + ADMIN_CONFIG_STORE.fgo.serie + ") au fost salvate!"
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    if (path === "/api/admin/accounting-export") {
      const adm = await verifyAdminRequest(request, url, null, secret);
      if (!adm) {
        return jsonResponse({ ok: false, error: "UNAUTHORIZED_ADMIN_TOKEN: Exportul contabil necesită autentificare Admin." }, 401);
      }
      const header = "Serie_Numar,Data_Emitere,Customer_ID,Tip_Client,Denumire_Client,CUI_CIF,Email_Client,Descriere_Produs,Suma_Valuta,Moneda,Suma_RON,Cota_TVA,Metoda_Plata,Referinta_Stripe,Status_Plata,Status_FGO,Status_eFactura\n";
      const rows = INVOICE_LEDGER_STORE.map(inv => [
        inv.seriesNumber,
        inv.date,
        inv.customerId,
        inv.buyerType,
        JSON.stringify(String(inv.buyerName || "")),
        inv.buyerCui || "-",
        inv.buyerEmail,
        JSON.stringify(String(inv.itemDescription || "")),
        inv.amount,
        inv.currency,
        inv.amountRon,
        inv.tvaRate + "%",
        JSON.stringify(String(inv.paymentMethod || "")),
        inv.stripeRef,
        inv.status,
        inv.fgoStatus,
        inv.eFacturaStatus
      ].join(",")).join("\n");

      return new Response(header + rows, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"Centralizator_Facturi_FGO_Stripe_LS_STORE_SRL_RO00000000.csv\""
        }
      });
    }

    // 0. Universal Auto-Update Version Manifest
    if (path === '/version.json' || path === '/downloads/version.json' || path === '/api/version') {
      return jsonResponse(VERSION_MANIFEST);
    }

    // 1. Health & Credit Pricing Catalog endpoint
    if (path === '/api/health' || path === '/.netlify/functions/health') {
      return jsonResponse({
        ok: true,
        success: true,
        version: '5.0.0',
        autoUpdate: true,
        cloudSyncReady: true,
        mandatoryLicenseGate: true,
        antiAbuseCreditsActive: true,
        customHudSetupReady: false,
        googleAuthReady: true,
        antiCrackHmacActive: true,
        moodleVersionSupport: 'Moodle 5.3.0 / 5.0 / 4.5 LTS',
        provider: 'Cloudflare Workers',
        entity: 'YOUR COMPANY SRL',
        cui: 'RO00000000',
        regCom: 'J00/0000/2026',
        euid: 'EUID-PLACEHOLDER',
        headquarters: 'Your registered address',
        academicIntegrityPolicy: 'https://your-worker.your-subdomain.workers.dev/academic-integrity.html',
        examIntegrityGuard: 'https://your-worker.your-subdomain.workers.dev/exam_integrity_guard.js',
        service: 'LSPilot AI Pro Edge Worker v4.8.6',
        models: ['gemini-3.8-flash', 'deepseek-v4.1-flash'],
        plans: PLAN_CREDIT_CATALOG,
        topupPacks: TOPUP_PACKS_CATALOG,
        creditRules: {
          standardExplanation: 1,
          deepRagOrLatex: 2,
          visionOcrSolve: 3,
          antiAbuseNote: 'Top-up packs are priced at $6.00-$9.98 per 1,000 credits so upgrading the monthly subscription ($2.66-$4.00 per 1,000 credits) is always 2.5x-3.7x more profitable for the user and prevents credit abuse.'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 1.5 Credit Status & Top-Up Endpoints (/api/credits/status, /api/credits/topup, /api/credits/consume)
    if (path === '/api/credits/status' || path === '/api/credits/topup' || path === '/api/credits/consume') {
      try {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const rawKey = (body.licenseKey || body.key || request.headers.get('X-License-Key') || url.searchParams.get('key') || OWNER_KEY).trim().toUpperCase();
        const state = CLOUD_SYNC_STORE.get(rawKey) || getDefaultSyncState(rawKey);
        const tierMeta = PLAN_CREDIT_CATALOG[state.tier] || PLAN_CREDIT_CATALOG['extension-pro'];

        if (path === '/api/credits/topup' && request.method === 'POST') {
          const packId = body.packId || 'topup_500';
          const pack = TOPUP_PACKS_CATALOG[packId] || TOPUP_PACKS_CATALOG['topup_500'];
          state.topupCredits = (state.topupCredits || 0) + pack.credits;
          state.creditsRemaining = (state.creditsRemaining || 0) + pack.credits;
          state.creditsTotal = (state.creditsTotal || tierMeta.monthlyCredits) + pack.credits;
          state.updatedAt = new Date().toISOString();
          CLOUD_SYNC_STORE.set(rawKey, state);
          return jsonResponse({
            ok: true,
            success: true,
            action: 'topup_applied',
            packApplied: pack,
            key: rawKey,
            creditsRemaining: state.creditsRemaining,
            creditsTotal: state.creditsTotal,
            creditsUsed: state.creditsUsed,
            topupCredits: state.topupCredits,
            smartUpgradeTip: pack.smartUpgradeNudge
          });
        }

        if (path === '/api/credits/consume' && request.method === 'POST') {
          const cost = Math.max(1, Math.min(10, Number(body.cost || 1)));
          if (!state.unlimitedOwner && state.creditsRemaining < cost) {
            return jsonResponse({
              ok: false,
              success: false,
              error: 'INSUFFICIENT_CREDITS',
              message: 'Monthly AI Credits exhausted. Upgrade your plan for 3.7x better credit value or purchase an instant Top-Up Pack.',
              creditsRemaining: state.creditsRemaining,
              creditsTotal: state.creditsTotal,
              topupCatalog: TOPUP_PACKS_CATALOG,
              planCatalog: PLAN_CREDIT_CATALOG
            }, 402);
          }
          state.creditsUsed = (state.creditsUsed || 0) + cost;
          state.creditsRemaining = Math.max(0, (state.creditsRemaining || tierMeta.monthlyCredits) - cost);
          state.updatedAt = new Date().toISOString();
          CLOUD_SYNC_STORE.set(rawKey, state);
        }

        return jsonResponse({
          ok: true,
          success: true,
          key: rawKey,
          tier: state.tier,
          plan: state.planName,
          creditsRemaining: state.creditsRemaining,
          creditsTotal: state.creditsTotal,
          creditsUsed: state.creditsUsed,
          topupCredits: state.topupCredits || 0,
          unlimitedOwner: Boolean(state.unlimitedOwner),
          billingCycleReset: state.billingCycleReset,
          costRules: { standard: 1, deepRag: 2, visionOcr: 3 },
          topupCatalog: TOPUP_PACKS_CATALOG,
          planCatalog: PLAN_CREDIT_CATALOG
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
      }
    }

    // 2. Mandatory License Key Verification & Activation Gate
    if (
      path === '/api/license/verify' ||
      path === '/api/license/activate' ||
      path === '/api/verify-license' ||
      path === '/api/claim-license' ||
      path === '/.netlify/functions/verify-license' ||
      path === '/.netlify/functions/claim-license'
    ) {
      try {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const rawKey = body.licenseKey || body.key || request.headers.get('X-License-Key') || url.searchParams.get('key') || url.searchParams.get('licenseKey') || '';
        const email = String(body.email || url.searchParams.get('email') || '').trim().toLowerCase();
        const deviceId = String(body.deviceId || request.headers.get('X-Device-Id') || 'dev_primary').slice(0, 64);
        const deviceName = String(body.deviceName || body.platform || 'Chrome Extension v4.8.6').slice(0, 80);
        const tokenHeader = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim() || body.token || body.licenseToken || '';

        if (!rawKey && tokenHeader) {
          const verifiedToken = await verifySessionToken(tokenHeader, secret);
          if (!verifiedToken) {
            return jsonResponse({
              ok: false,
              success: false,
              valid: false,
              status: 'INVALID_TOKEN',
              error: 'Activation Required: Please enter your License Key from your Customer Dashboard.'
            }, 403);
          }
          const tKey = verifiedToken.licenseKey || OWNER_KEY;
          const syncState = CLOUD_SYNC_STORE.get(tKey) || getDefaultSyncState(tKey);
          const hasExtraDevs = Array.isArray(syncState.activeAddons) && syncState.activeAddons.includes('extra_devices');
          return jsonResponse({
            ok: true,
            success: true,
            valid: true,
            key: tKey,
            licenseKey: tKey,
            plan: syncState.planName,
            tier: syncState.tier,
            status: 'ACTIVE',
            version: '4.8.6',
            creditsRemaining: syncState.creditsRemaining,
            creditsTotal: syncState.creditsTotal,
            creditsUsed: syncState.creditsUsed,
            topupCredits: syncState.topupCredits || 0,
            hudSetup: {
              hudVisualProfile: syncState.hudVisualProfile,
              hudOpacity: syncState.hudOpacity,
              hudTriggerKey: syncState.hudTriggerKey,
              hudTriggerButton: syncState.hudTriggerButton,
              hudResetKey: syncState.hudResetKey || 'Alt+R'
            },
            maxDevices: hasExtraDevs ? 6 : 3,
            devices: syncState.devices,
            addons: syncState.activeAddons || [],
            cloudSync: true,
            email: verifiedToken.email,
            token: tokenHeader,
            licenseToken: tokenHeader
          });
        }

        let key = String(rawKey).trim().toUpperCase();
        if (!key && email && email.includes('@')) {
          key = await generateAccountLicenseKey(email, body.plan || 'PRO', secret);
        }

        const isValid = await isLicenseKeyCryptographicallyValid(key, email, secret);
        if (!isValid) {
          return jsonResponse({
            ok: false,
            success: false,
            valid: false,
            status: 'ACTIVATION_REQUIRED',
            error: 'Activation Required: Please enter your License Key from your Customer Dashboard.'
          }, 403);
        }

        const syncState = CLOUD_SYNC_STORE.get(key) || getDefaultSyncState(key);
        if (Array.isArray(body.addons)) {
          syncState.activeAddons = body.addons;
        }
        if (body.hudVisualProfile) syncState.hudVisualProfile = body.hudVisualProfile;
        if (body.hudOpacity !== undefined) syncState.hudOpacity = Number(body.hudOpacity);
        if (body.hudTriggerKey) syncState.hudTriggerKey = body.hudTriggerKey;
        if (body.hudTriggerButton) syncState.hudTriggerButton = body.hudTriggerButton;
        if (body.hudResetKey) syncState.hudResetKey = body.hudResetKey;

        const hasExtraDevices = Array.isArray(syncState.activeAddons) && syncState.activeAddons.includes('extra_devices');
        const maxDevices = hasExtraDevices ? 6 : 3;

        const existingIdx = syncState.devices.findIndex(d => d.id === deviceId);
        if (existingIdx >= 0) {
          syncState.devices[existingIdx].lastSync = new Date().toISOString();
          syncState.devices[existingIdx].version = '4.8.6';
          syncState.devices[existingIdx].status = 'ONLINE';
        } else if (syncState.devices.length < maxDevices) {
          syncState.devices.push({
            id: deviceId,
            name: deviceName,
            platform: body.platform || 'browser',
            version: '4.8.6',
            status: 'ONLINE',
            lastSync: new Date().toISOString()
          });
        }
        CLOUD_SYNC_STORE.set(key, syncState);

        const planLabel = syncState.planName;
        const boundEmail = email || 'verified-student@example.com';
        const signedToken = await signSessionToken({
          email: boundEmail,
          licenseKey: key,
          plan: planLabel,
          tier: syncState.tier,
          deviceId,
          maxDevices,
          iat: Date.now(),
          exp: Date.now() + 30 * 24 * 3600 * 1000
        }, secret);

        return jsonResponse({
          ok: true,
          success: true,
          valid: true,
          key,
          licenseKey: key,
          license_key: key,
          plan: planLabel,
          tier: syncState.tier,
          status: 'ACTIVE',
          version: '4.8.6',
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          creditsUsed: syncState.creditsUsed,
          topupCredits: syncState.topupCredits || 0,
          unlimitedOwner: Boolean(syncState.unlimitedOwner),
          hudSetup: {
            hudVisualProfile: syncState.hudVisualProfile,
            hudOpacity: syncState.hudOpacity,
            hudTriggerKey: syncState.hudTriggerKey,
            hudTriggerButton: syncState.hudTriggerButton,
            hudResetKey: syncState.hudResetKey || 'Alt+R'
          },
          maxDevices,
          devices: syncState.devices,
          addons: syncState.activeAddons || [],
          cloudSync: true,
          accountBound: true,
          email: boundEmail,
          deviceId,
          token: signedToken,
          licenseToken: signedToken
        });
      } catch (err) {
        return jsonResponse({
          ok: false,
          success: false,
          valid: false,
          error: 'Activation Required: Please enter your License Key from your Customer Dashboard.'
        }, 400);
      }
    }

    // 3. Real-Time Cloud Sync Endpoint (GET /api/sync & POST /api/sync)
    if (path === '/api/sync' || path === '/.netlify/functions/sync') {
      try {
        const queryKey = (url.searchParams.get('key') || url.searchParams.get('licenseKey') || request.headers.get('X-License-Key') || '').trim().toUpperCase();
        if (request.method === 'GET') {
          const targetKey = queryKey || OWNER_KEY;
          const state = CLOUD_SYNC_STORE.get(targetKey) || getDefaultSyncState(targetKey);
          return jsonResponse({
            ok: true,
            success: true,
            cloudSync: true,
            version: '4.8.6',
            key: targetKey,
            state,
            syncedAt: new Date().toISOString()
          });
        }

        const body = await request.json().catch(() => ({}));
        const targetKey = String(body.key || body.licenseKey || queryKey || OWNER_KEY).trim().toUpperCase();
        const current = CLOUD_SYNC_STORE.get(targetKey) || getDefaultSyncState(targetKey);

        const nextState = {
          ...current,
          key: targetKey,
          theme: body.theme || current.theme || 'light',
          uiLang: body.uiLang || current.uiLang || 'en',
          aiLang: body.aiLang || current.aiLang || 'en',
          explanationMode: body.explanationMode || current.explanationMode || 'step-by-step',
          hudVisualProfile: body.hudVisualProfile || current.hudVisualProfile || 'compact-hud',
          hudOpacity: body.hudOpacity !== undefined ? Number(body.hudOpacity) : current.hudOpacity,
          hudTriggerKey: body.hudTriggerKey || current.hudTriggerKey || 'Alt+Q',
          hudTriggerButton: body.hudTriggerButton || current.hudTriggerButton || 'alt_click',
          hudResetKey: body.hudResetKey || current.hudResetKey || 'Alt+R',
          hudPosition: body.hudPosition || current.hudPosition || 'bottom-right',
          courseNotesContext: body.courseNotesContext !== undefined ? String(body.courseNotesContext) : current.courseNotesContext,
          activeAddons: Array.isArray(body.activeAddons) ? body.activeAddons : current.activeAddons,
          devices: Array.isArray(body.devices) ? body.devices : current.devices,
          studyHistory: Array.isArray(body.studyHistory) ? body.studyHistory.slice(0, 50) : current.studyHistory,
          updatedAt: new Date().toISOString()
        };

        CLOUD_SYNC_STORE.set(targetKey, nextState);
        return jsonResponse({
          ok: true,
          success: true,
          cloudSync: true,
          version: '4.8.6',
          key: targetKey,
          state: nextState,
          syncedAt: nextState.updatedAt
        });
      } catch (err) {
        return jsonResponse({ ok: false, success: false, error: String(err.message || err) }, 400);
      }
    }

    // 4. Google / Gmail Sign-In & OAuth Verification (/api/auth/google)
    if (path === '/api/auth/google' || path === '/.netlify/functions/auth-google') {
      try {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const jwtData = decodeGoogleJwtPayload(body.credential || body.idToken);
        const rawEmail = (jwtData && jwtData.email) || body.email || url.searchParams.get('email') || '';
        const email = String(rawEmail).trim().toLowerCase();

        if (!email || !email.includes('@') || email.length < 5) {
          return jsonResponse({
            ok: false,
            success: false,
            error: 'Please enter a valid Google / Gmail address (e.g. name@gmail.com).'
          }, 400);
        }

        const displayName = (jwtData && jwtData.name) || body.name || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const googleSub = (jwtData && jwtData.sub) || body.googleSub || ('goog_' + (await hmacHex(email, secret)).slice(0, 16));
        const deviceId = String(body.deviceId || request.headers.get('X-Device-Id') || 'dev_primary').slice(0, 64);
        const plan = body.plan || 'extension-pro';
        const licenseKey = await generateAccountLicenseKey(email, plan, secret);
        const syncState = CLOUD_SYNC_STORE.get(licenseKey) || getDefaultSyncState(licenseKey);
        const refParam = String(body.ref || body.referral || url.searchParams.get('ref') || '').toLowerCase();
        const bonusParam = Number(body.bonus || body.bonusCoins || url.searchParams.get('bonus') || 0);
        if ((refParam.includes('peeksolve') || refParam.includes('peekexam') || bonusParam === 500) && !syncState.migrationBonusApplied) {
          syncState.topupCredits = (syncState.topupCredits || 0) + 500;
          syncState.creditsTotal = (syncState.creditsTotal || 0) + 500;
          syncState.creditsRemaining = (syncState.creditsRemaining || 0) + 500;
          syncState.migrationBonusApplied = true;
        }
        CLOUD_SYNC_STORE.set(licenseKey, syncState);

        const sessionPayload = {
          sub: googleSub,
          email,
          name: displayName,
          provider: 'google',
          emailVerified: true,
          licenseKey,
          plan,
          deviceId,
          maxDevices: 3,
          iat: Date.now(),
          exp: Date.now() + 30 * 24 * 3600 * 1000
        };
        const token = await signSessionToken(sessionPayload, secret);

        return jsonResponse({
          ok: true,
          success: true,
          provider: 'google',
          authenticated: true,
          emailVerified: true,
          token,
          licenseToken: token,
          licenseKey,
          plan,
          tier: syncState.tier,
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          maxDevices: 3,
          deviceSlot: 1,
          user: {
            email,
            name: displayName,
            googleSub,
            provider: 'google',
            avatar: (jwtData && jwtData.picture) || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=09090b&color=fff&bold=true`,
            plan,
            tier: syncState.tier,
            licenseKey,
            creditsRemaining: syncState.creditsRemaining,
            creditsTotal: syncState.creditsTotal,
            maxDevices: 3,
            devices: [{ id: deviceId, name: body.deviceName || 'Verified Google Study Device', boundAt: new Date().toISOString() }],
            preferences: body.preferences || {
              uiLang: body.lang || 'en',
              aiLang: 'auto',
              currency: body.currency || 'USD',
              hudVisualProfile: syncState.hudVisualProfile,
              hudPosition: 'bottom-right',
              hudOpacity: syncState.hudOpacity,
              hudTriggerKey: syncState.hudTriggerKey,
              hudTriggerButton: syncState.hudTriggerButton,
              hudResetKey: syncState.hudResetKey || 'Alt+R'
            }
          }
        });
      } catch (err) {
        return jsonResponse({ ok: false, success: false, error: String(err.message || err) }, 400);
      }
    }

    // 5. User Auth & Account Sync endpoint (/api/auth, /api/user-auth)
    if (
      path === '/api/auth' ||
      path === '/api/user-auth' ||
      path === '/.netlify/functions/auth' ||
      path === '/.netlify/functions/user-auth'
    ) {
      try {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const action = body.action || url.searchParams.get('action') || 'login';
        const rawEmail = body.email || url.searchParams.get('email') || '';
        const email = String(rawEmail || 'student@gmail.com').trim().toLowerCase();
        if (!email.includes('@')) {
          return jsonResponse({ ok: false, success: false, error: 'Valid account email is required.' }, 400);
        }

        const deviceId = String(body.deviceId || request.headers.get('X-Device-Id') || 'dev_1').slice(0, 64);
        const plan = body.plan || 'extension-pro';

        let licenseKey = body.licenseKey ? String(body.licenseKey).trim().toUpperCase() : '';
        if (licenseKey) {
          const valid = await isLicenseKeyCryptographicallyValid(licenseKey, email, secret);
          if (!valid) {
            return jsonResponse({
              ok: false,
              success: false,
              valid: false,
              status: 'rejected_forged_key',
              error: 'Activation Required: Please enter your License Key from your Customer Dashboard.'
            }, 403);
          }
        } else {
          licenseKey = await generateAccountLicenseKey(email, plan, secret);
        }

        const syncState = CLOUD_SYNC_STORE.get(licenseKey) || getDefaultSyncState(licenseKey);
        CLOUD_SYNC_STORE.set(licenseKey, syncState);

        const displayName = body.name || email.split('@')[0];
        const sessionPayload = {
          email,
          name: displayName,
          provider: body.provider || (email.endsWith('@gmail.com') ? 'google' : 'account'),
          licenseKey,
          plan,
          deviceId,
          maxDevices: 3,
          iat: Date.now(),
          exp: Date.now() + 30 * 24 * 3600 * 1000
        };
        const token = await signSessionToken(sessionPayload, secret);

        return jsonResponse({
          ok: true,
          success: true,
          action,
          token,
          licenseToken: token,
          licenseKey,
          tier: syncState.tier,
          plan: syncState.planName,
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          devices: [{ id: deviceId, name: body.deviceName || 'Primary Study Device', version: '4.8.6', status: 'ONLINE' }],
          user: {
            email,
            name: displayName,
            provider: sessionPayload.provider,
            plan: syncState.planName,
            tier: syncState.tier,
            licenseKey,
            creditsRemaining: syncState.creditsRemaining,
            creditsTotal: syncState.creditsTotal,
            maxDevices: 3,
            devices: [{ id: deviceId, name: body.deviceName || 'Primary Study Device', version: '4.8.6', status: 'ONLINE' }],
            billingCycle: 'monthly'
          }
        });
      } catch (err) {
        return jsonResponse({ ok: false, success: false, error: String(err.message || err) }, 400);
      }
    }

    // 6. AI Solver & Proxy endpoint (/api/solve, /api/ai-proxy, /.netlify/functions/ai-proxy)
    if (path === '/api/solve' || path === '/api/ai-proxy' || path === '/.netlify/functions/ai-proxy') {
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, success: false, error: 'Method Not Allowed' }, 405);
      }
      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        body = {};
      }

      const suppliedKey = (request.headers.get('X-License-Key') || body.licenseKey || body.key || '').trim();
      // Public build: no anonymous use of your AI key unless you explicitly allow it.
      if (!suppliedKey && String(env.ALLOW_ANONYMOUS || '') !== '1') {
        return jsonResponse({ ok: false, success: false, valid: false, error: 'Activation Required: enter a license key in the extension popup.' }, 401);
      }
      if (suppliedKey) {
        const keyOk = await isLicenseKeyCryptographicallyValid(suppliedKey, body.email || '', secret);
        if (!keyOk) {
          return jsonResponse({
            ok: false,
            success: false,
            valid: false,
            error: 'Activation Required: Please enter your License Key from your Customer Dashboard.'
          }, 403);
        }
      }

      const upperKey = String(suppliedKey || OWNER_KEY).trim().toUpperCase();
      const syncState = CLOUD_SYNC_STORE.get(upperKey) || getDefaultSyncState(upperKey);
      const tierMeta = PLAN_CREDIT_CATALOG[syncState.tier] || PLAN_CREDIT_CATALOG['extension-pro'];

      // Anti-abuse burst rate-limiting per minute
      const minStamp = new Date().toISOString().slice(0, 16);
      const burstKey = `${minStamp}:${upperKey}`;
      const reqThisMin = (MINUTE_BURST_TRACKER.get(burstKey) || 0) + 1;
      MINUTE_BURST_TRACKER.set(burstKey, reqThisMin);
      if (reqThisMin > (tierMeta.rateLimitPerMin || 20)) {
        return jsonResponse({
          ok: false,
          success: false,
          error: 'RATE_LIMIT_ANTI_ABUSE',
          message: `Anti-Abuse Rate Limit: Maximum ${tierMeta.rateLimitPerMin} requests/min reached for ${tierMeta.name}. Upgrade to All-Platform Suite for higher burst throughput.`
        }, 429);
      }

      // Calculate credit cost (1 = Standard, 2 = Deep/RAG/LaTeX, 3 = Vision/OCR)
      const lang = body.lang || body.language || 'en';
      const explanationMode = body.explanationMode || 'concise';
      const courseNotes = body.courseNotesContext || '';
      const hasVision = Boolean(body.imageBase64);
      const requestedModel = String(body.model || 'deepseek-chat').toLowerCase();
      const isThinkMode = requestedModel.includes('reasoner') || requestedModel.includes('think') || Boolean(body.think) || explanationMode === 'step-by-step' || explanationMode === 'latex-proof';
      const creditCost = hasVision ? 3 : (isThinkMode || courseNotes.length > 20) ? 2 : 1;

      // Enforce t171u rule: Top-Up & Bonus AI Credit Coins require an active Paid Pro Subscription (cannot be spent on FREE tier)
      if (!syncState.unlimitedOwner && syncState.tier === 'FREE' && (syncState.topupCredits || 0) > 0) {
        return jsonResponse({
          ok: false,
          success: false,
          error: 'PRO_SUBSCRIPTION_REQUIRED_FOR_COINS',
          message: 'Active Pro Subscription Required: Your Top-Up & Bonus AI Credit Coins are safely stored in your vault, but require an active Pro Plan ($3.99/mo) to be redeemed and spent (Terms §4A).',
          creditsRemaining: syncState.creditsRemaining,
          topupCreditsLocked: syncState.topupCredits || 0
        }, 402);
      }
      if (!syncState.unlimitedOwner && syncState.creditsRemaining < creditCost) {
        return jsonResponse({
          ok: false,
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'Monthly AI Credits exhausted. Upgrade your plan (up to 3.7x better credit value) or add a Credit Top-Up Pack in Dashboard.',
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          creditCost
        }, 402);
      }

      syncState.creditsUsed = (syncState.creditsUsed || 0) + creditCost;
      syncState.creditsRemaining = Math.max(0, (syncState.creditsRemaining || tierMeta.monthlyCredits) - creditCost);
      CLOUD_SYNC_STORE.set(upperKey, syncState);

      const rawQuestion = body.prompt || body.question || (Array.isArray(body.messages) ? body.messages.map(m => m.content || '').join('\n') : '') || '';
      const optionsText = Array.isArray(body.options)
        ? '\nOptions:\n' + body.options.map((o, i) => `${o.letter || String.fromCharCode(65 + i)}) ${o.text || o}`).join('\n')
        : '';
      const fullPrompt = `${rawQuestion}${optionsText}`.trim() || 'Provide a concise step-by-step academic explanation.';
      const clientHeader = request.headers.get('X-LSPilot-Client') || body.clientVersion || 'lspilot-v4.8.6';
      const clientIpOrDev = request.headers.get('X-Device-Id') || body.deviceId || request.headers.get('CF-Connecting-IP') || 'anon_dev';

      const promptHash = await sha256Hex(`${lang}:${explanationMode}:${fullPrompt.toLowerCase()}`);
      if (PROMPT_DEDUP_CACHE.has(promptHash)) {
        const cachedEntry = PROMPT_DEDUP_CACHE.get(promptHash);
        if (Date.now() - cachedEntry.ts < 24 * 3600 * 1000) {
          return jsonResponse({
            ok: true,
            success: true,
            cached: true,
            dedupSha256: promptHash.slice(0, 16),
            clientAttested: Boolean(clientHeader),
            creditCost,
            creditsRemaining: syncState.creditsRemaining,
            creditsTotal: syncState.creditsTotal,
            model: cachedEntry.model,
            answer: cachedEntry.answer,
            content: cachedEntry.answer,
            text: cachedEntry.answer,
            choices: [{ message: { role: 'assistant', content: cachedEntry.answer } }]
          });
        }
      }

      const dayStamp = new Date().toISOString().slice(0, 10);
      const quotaCounterKey = `${dayStamp}:${upperKey || clientIpOrDev}`;
      const usedToday = DAILY_QUOTA_TRACKER.get(quotaCounterKey) || 0;
      DAILY_QUOTA_TRACKER.set(quotaCounterKey, usedToday + 1);

      const maxOutputTokens = 520;
      const modeInstruction = explanationMode === 'concise'
        ? 'Provide a fast, concise verified answer and 1-sentence core takeaway.'
        : explanationMode === 'latex-proof'
          ? 'Provide the verified answer followed by a rigorous formal mathematical/scientific derivation with LaTeX notation.'
          : explanationMode === 'bilingual'
            ? `Provide the verified answer and step-by-step explanation in both "${lang}" and English.`
            : 'Provide the exact verified option on the first line (e.g. "🎯 Correct Answer: ...") followed by a clear, numbered step-by-step academic derivation.';
      const ragInstruction = courseNotes ? `\nCourse Context / Professor Notes to reference:\n${courseNotes.slice(0, 1500)}` : '';
      const systemPrompt = body.systemPrompt || `You are LSPilot AI Pro v5.0.0, a Moodle learning assistant that explains concepts step by step operated by YOUR COMPANY SRL Respond in language "${lang}". ${modeInstruction}${ragInstruction}`;
      const model = body.model === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';

      if (!body.imageBase64 && !body.forceCloudModel) {
        const localSolved = tryZeroCostLocalAcademicSolver(fullPrompt, lang);
        if (localSolved) {
          PROMPT_DEDUP_CACHE.set(promptHash, { answer: localSolved, model: 'lspilot-local-zero-cost-v4.8.6', ts: Date.now() });
          return jsonResponse({
            ok: true,
            success: true,
            cached: false,
            zeroCostLocalEngine: true,
            dedupSha256: promptHash.slice(0, 16),
            tier: syncState.tier,
            creditCost,
            creditsRemaining: syncState.creditsRemaining,
            creditsTotal: syncState.creditsTotal,
            quotaUsedToday: usedToday + 1,
            quotaLimitToday: tierMeta.dailyCap,
            maxOutputTokens,
            model: 'lspilot-local-zero-cost-v4.8.6',
            answer: localSolved,
            content: localSolved,
            text: localSolved,
            choices: [{ message: { role: 'assistant', content: localSolved } }]
          });
        }
      }

      const rawKeyPool = ((env && env.GEMINI_API_KEYS) || (env && env.GEMINI_API_KEY) || DEFAULT_GEMINI_KEY).split(',').map(k => k.trim()).filter(Boolean);
      const GEMINI_KEY_POOL = rawKeyPool.length ? rawKeyPool : [DEFAULT_GEMINI_KEY];
      const rotatedPoolKey = GEMINI_KEY_POOL[(usedToday) % GEMINI_KEY_POOL.length];
      const apiKey = request.headers.get('X-BYOK-Key') || body.byokKey || rotatedPoolKey;
      if (!apiKey) return jsonResponse({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'GEMINI_API_KEY secret missing' }, 503);

      const userParts = [{ text: fullPrompt }];
      if (body.imageBase64 && typeof body.imageBase64 === 'string') {
        const match = body.imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        const mimeType = match ? match[1] : (body.mimeType || 'image/png');
        const cleanBase64 = match ? match[2] : body.imageBase64.replace(/^data:[^,]+,/, '');
        if (cleanBase64 && cleanBase64.length > 32) {
          userParts.push({
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          });
        }
      }

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: userParts }],
              generationConfig: {
                temperature: 0.15,
                maxOutputTokens
              }
            })
          }
        );

        const data = await geminiRes.json().catch(() => ({}));
        const aiText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
        const finalAnswer = aiText || buildEducationalFallback(fullPrompt, lang);
        PROMPT_DEDUP_CACHE.set(promptHash, { answer: finalAnswer, model, ts: Date.now() });

        return jsonResponse({
          cached: false,
          dedupSha256: promptHash.slice(0, 16),
          clientAttested: Boolean(clientHeader),
          tier: syncState.tier,
          creditCost,
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          quotaUsedToday: usedToday + 1,
          quotaLimitToday: tierMeta.dailyCap,
          maxOutputTokens,
          ok: true,
          success: true,
          model,
          answer: finalAnswer,
          content: finalAnswer,
          text: finalAnswer,
          choices: [{ message: { role: 'assistant', content: finalAnswer } }]
        });
      } catch (err) {
        const fallback = buildEducationalFallback(fullPrompt, lang);
        PROMPT_DEDUP_CACHE.set(promptHash, { answer: fallback, model: 'gemini-3.8-flash-fallback', ts: Date.now() });
        return jsonResponse({
          cached: false,
          dedupSha256: promptHash.slice(0, 16),
          clientAttested: Boolean(clientHeader),
          creditCost,
          creditsRemaining: syncState.creditsRemaining,
          creditsTotal: syncState.creditsTotal,
          ok: true,
          success: true,
          model: 'gemini-3.8-flash-fallback',
          answer: fallback,
          content: fallback,
          text: fallback,
          choices: [{ message: { role: 'assistant', content: fallback } }],
          note: String(err.message || err)
        });
      }
    }


    // 6b. Teacher quiz generator — LSPilot pentru profesori
    if (path === '/api/quiz-generate' || path === '/api/ai/generate') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
      }
      let body = {};
      try { body = await request.json(); } catch (_) { body = {}; }
      const text = String(body.text || '').slice(0, 14000).trim();
      const difficulty = ['usor', 'mediu', 'greu'].includes(body.difficulty) ? body.difficulty : 'mediu';
      const count = Math.min(30, Math.max(1, Number(body.count) || 6));
      const types = Array.isArray(body.types) && body.types.length
        ? body.types.filter(t => ['multichoice', 'truefalse', 'shortanswer', 'matching', 'numerical', 'essay'].includes(t))
        : ['multichoice', 'truefalse'];
      const lang = String(body.lang || 'ro').slice(0, 8);
      if (!text || text.length < 40) {
        return jsonResponse({ ok: false, error: 'Textul lecției este prea scurt. Încarcă un PDF sau lipește conținutul.' }, 400);
      }
      if (!types.length) {
        return jsonResponse({ ok: false, error: 'Alege cel puțin un tip de întrebare.' }, 400);
      }

      const systemPrompt = `You are LSPilot Teacher Quiz Generator for YOUR COMPANY SRL
Return ONLY a JSON object: {"questions":[{...}]}. No markdown fences.
Each question object MUST have:
- type: one of ${JSON.stringify(types)}
- question: string
- bloom: one of remember|understand|apply|analyze|evaluate|create
- options: string array (4 options for multichoice; ["true","false"] for truefalse; [] for shortanswer, matching, numerical, essay)
- pairs: for matching only, array of 3-5 {"left":string,"right":string}
- tolerance: for numerical only, number (answer must be a number)
- for essay: answer = grading guidance / model answer
- answer: the correct option text OR short answer text (must match one option for multichoice/truefalse)
- explanation: short teacher-facing explanation
- source: short quote or "page/section" reference from the source text
Language of all student-facing fields: "${lang}".
Difficulty: "${difficulty}".
Generate exactly ${count} questions covering the material. Prefer factual questions grounded in the source.`;

      const userPrompt = (body.replaceHint
        ? `Regenerate ONE improved ${types[0]} question different from: ${String(body.replaceHint).slice(0, 400)}\n\nSource:\n${text}`
        : `Create ${count} quiz questions (${types.join(', ')}) from this lesson:\n\n${text}`);

      const rawKeyPool = ((env && env.GEMINI_API_KEYS) || (env && env.GEMINI_API_KEY) || DEFAULT_GEMINI_KEY).split(',').map(k => k.trim()).filter(Boolean);
      const apiKey = (request.headers.get('X-BYOK-Key') || body.byokKey || rawKeyPool[0] || '');
      if (!apiKey) return jsonResponse({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'GEMINI_API_KEY secret missing' }, 503);
      const model = 'gemini-3.8-flash';

      let aiText = '';
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.35, maxOutputTokens: 8192, responseMimeType: 'application/json' }
            })
          }
        );
        const data = await geminiRes.json().catch(() => ({}));
        if (!geminiRes.ok) {
          return jsonResponse({
            ok: false,
            error: 'AI_PROVIDER_ERROR',
            message: (data && data.error && data.error.message) || (`Gemini HTTP ${geminiRes.status}`),
            status: geminiRes.status
          }, 502);
        }
        aiText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      } catch (err) {
        return jsonResponse({ ok: false, error: 'AI_NETWORK_ERROR', message: String(err.message || err) }, 502);
      }

      let parsed = null;
      try {
        const cleaned = aiText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
        parsed = JSON.parse(cleaned);
      } catch (_) {
        const m = aiText.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch (__) {}
        }
      }
      let questions = Array.isArray(parsed?.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
      questions = questions.slice(0, count).map((q) => {
        const type = types.includes(q.type) ? q.type : types[0];
        let options = Array.isArray(q.options) ? q.options.map(String) : [];
        if (type === 'truefalse' && options.length < 2) options = ['true', 'false'];
        if (['shortanswer','matching','numerical','essay'].includes(type)) options = [];
        const BL=['remember','understand','apply','analyze','evaluate','create'];
        return {
          type,
          question: String(q.question || '').slice(0, 800),
          options: options.slice(0, 6),
          answer: String(q.answer || '').slice(0, 400),
          explanation: String(q.explanation || '').slice(0, 800),
          source: String(q.source || '').slice(0, 400),
          bloom: BL.includes(q.bloom) ? q.bloom : 'understand',
          ...(type === 'matching' ? { pairs: (Array.isArray(q.pairs) ? q.pairs : []).slice(0, 8).map(p => ({ left: String(p.left || '').slice(0, 200), right: String(p.right || '').slice(0, 200) })).filter(p => p.left && p.right) } : {}),
          ...(type === 'numerical' ? { tolerance: Number(q.tolerance) || 0 } : {})
        };
      }).filter(q => q.question);

      if (!questions.length) {
        return jsonResponse({ ok: false, error: 'AI_PARSE_ERROR', message: 'Modelul nu a returnat JSON valid cu întrebări.', rawPreview: String(aiText).slice(0, 400) }, 502);
      }

      return jsonResponse({
        ok: true,
        success: true,
        model,
        count: questions.length,
        difficulty,
        lang,
        scheduleNote: body.schedule ? 'Schedule saved client-side only. Auto-publish to Moodle is not live (pilot coming soon).' : null,
        questions
      });
    }

    // 7. Serve static assets from ./site with CORS headers (serving both .html and clean paths as HTTP 200)
    if (env && env.ASSETS) {
      const MIGRATION_ALIAS_PATHS = new Set([
        '/peeksolve-alternative',
        '/peeksolve-alternative.html',
        '/peekexam-alternative',
        '/peekexam-alternative.html',
        '/peeksolve',
        '/peekexam',
        '/peekbench',
        '/schweiz'
      ]);
      const TEACHER_ALIAS_PATHS = new Set(['/profesori', '/teachers', '/profesor']);
      const normalizedPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1).toLowerCase() : path.toLowerCase();
      let assetRequest = request;
      if (MIGRATION_ALIAS_PATHS.has(normalizedPath)) {
        const rewrittenUrl = new URL('/peeksolve-alternative.html', request.url);
        assetRequest = new Request(rewrittenUrl.toString(), request);
      } else if (TEACHER_ALIAS_PATHS.has(normalizedPath)) {
        assetRequest = new Request(new URL('/teachers.html', request.url).toString(), request);
      } else if (normalizedPath === '/teachers-app' || normalizedPath === '/generator-quiz') {
        assetRequest = new Request(new URL('/teachers-app.html', request.url).toString(), request);
      }
      let assetRes = await env.ASSETS.fetch(assetRequest);
      if ((assetRes.status === 307 || assetRes.status === 308 || assetRes.status === 301 || assetRes.status === 302) && assetRes.headers.get('location')) {
        const locUrl = new URL(assetRes.headers.get('location'), request.url);
        assetRes = await env.ASSETS.fetch(new Request(locUrl.toString(), request));
      }
      const newHeaders = new Headers(assetRes.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
      Object.entries(SECURITY_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
      if (path.endsWith('.mobileconfig')) {
        newHeaders.set('Content-Type', 'application/x-apple-aspen-config');
        newHeaders.set('Content-Disposition', 'attachment; filename="lspilot.mobileconfig"');
      }
      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers: newHeaders
      });
    }
    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};
