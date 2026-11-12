// Set this to YOUR deployed worker (see ../worker). If you use a custom domain, add it to host_permissions in manifest.json.
const API_BASE = 'https://your-worker.your-subdomain.workers.dev';
const API = API_BASE + '/api/ai-proxy';
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type !== 'ask') return;
  chrome.storage.local.get({ licenseKey: '', lang: 'ro' }).then(async ({ licenseKey, lang }) => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LSPilot-Client': 'lspilot-v5.0.0' },
        body: JSON.stringify({ prompt: msg.prompt, systemPrompt: msg.system + ` Respond in language "${lang}".`, lang, licenseKey, explanationMode: 'step-by-step' }) });
      const d = await r.json();
      reply({ ok: r.ok, text: d.answer || d.content || d.message || d.error || 'Eroare' });
    } catch (e) { reply({ ok: false, text: 'Eroare de rețea: ' + e.message }); }
  });
  return true;
});
