/* LSPilot AI Pro v5 – visible learning assistant. Stays off when exam_mode.js reports exam mode. */
(function () {
  'use strict';
  if (window !== window.top || window.__LSPILOT_EXAM_MODE__) return;
  const SYS = {
    explain: 'You are a patient tutor. Explain the concept step by step so the student understands it. Do not just state a final answer; end with one check question.',
    hint: 'You are a tutor. Give ONE short hint that guides the student toward solving this themselves. Do not reveal the answer.',
    summary: 'Summarize this learning material into clear bullet points with key terms and formulas.',
    flashcards: 'Create 8 flashcards (Q: ... / A: ...) from this learning material.',
    similar: 'Create 3 new practice questions similar to this one, with worked solutions at the end under a "Solutions" heading.',
    mistakes: 'The student finished a quiz. For each wrong answer below, explain briefly why their answer was wrong and what the key idea is. Then create a personalized practice set of 5 questions targeting these weak points, with solutions at the end.'
  };
  const isReview = /\/mod\/quiz\/review\.php/.test(location.pathname);
  let panel, body;
  const selection = () => (getSelection() ? getSelection().toString().trim() : '');
  const pageText = () => (document.querySelector('#region-main, main, article') || document.body).innerText.slice(0, 6000);
  function ask(kind, text) {
    body.textContent = '⏳ Se gândește...';
    chrome.runtime.sendMessage({ type: 'ask', system: SYS[kind], prompt: text }, (r) => {
      body.textContent = r ? r.text : 'Eroare';
      chrome.storage.local.get({ history: [] }, ({ history }) => {
        history.unshift({ kind, t: Date.now(), url: location.href, q: text.slice(0, 500), a: (r && r.text || '').slice(0, 4000) });
        chrome.storage.local.set({ history: history.slice(0, 100) });
      });
    });
  }
  function wrongAnswers() {
    return [...document.querySelectorAll('.que.incorrect, .que.partiallycorrect')].map((q, i) => {
      const t = (q.querySelector('.qtext') || q).innerText.trim().slice(0, 800);
      const mine = [...q.querySelectorAll('.answer .incorrect, .answer input:checked')].map(e => (e.closest('div') || e).innerText.trim()).join('; ');
      const right = (q.querySelector('.rightanswer') || {}).innerText || '';
      return `${i + 1}. ${t}\nMy answer: ${mine}\n${right}`;
    });
  }
  function build() {
    const fab = document.createElement('button');
    fab.id = 'lspilot-fab'; fab.textContent = '📘 LSPilot';
    panel = document.createElement('div'); panel.id = 'lspilot-panel'; panel.style.display = 'none';
    panel.innerHTML = '<header><span>📘 LSPilot – Mod învățare</span><span><button data-a="reset" title="Clears only the session state">Reset sesiune</button> <button data-a="close">✕</button></span></header><div class="lsp-body">Selectează un text sau o întrebare din lecție și alege o acțiune.</div><div class="lsp-btns"><button data-a="explain">Explică pas cu pas</button><button data-a="hint">Indiciu</button><button data-a="summary">Rezumat pagină</button><button data-a="flashcards">Flashcard-uri</button><button data-a="similar">Exerciții similare</button>' + (isReview ? '<button data-a="mistakes">Învață din greșeli</button>' : '') + '<textarea placeholder="Sau scrie întrebarea ta..."></textarea></div>';
    document.body.append(fab, panel);
    body = panel.querySelector('.lsp-body');
    fab.onclick = () => { panel.style.display = 'flex'; fab.style.display = 'none'; };
    panel.addEventListener('click', (e) => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      const typed = panel.querySelector('textarea').value.trim();
      if (a === 'close') { panel.style.display = 'none'; fab.style.display = ''; return; }
      if (a === 'reset') { chrome.storage.local.remove(['history', 'practiceSets']); body.textContent = 'Sesiune resetată.'; return; }
      if (a === 'summary' || a === 'flashcards') return ask(a, selection() || pageText());
      if (a === 'mistakes') {
        const w = wrongAnswers();
        if (!w.length) { body.textContent = 'Nu am găsit răspunsuri greșite pe această pagină de revizuire. 👏'; return; }
        chrome.storage.local.get({ practiceSets: [] }, ({ practiceSets }) => { practiceSets.unshift({ t: Date.now(), url: location.href, wrong: w }); chrome.storage.local.set({ practiceSets: practiceSets.slice(0, 30) }); });
        return ask('mistakes', w.join('\n\n'));
      }
      const q = typed || selection();
      if (!q) { body.textContent = 'Selectează întâi un text sau scrie o întrebare.'; return; }
      ask(a, q);
    });
  }
  if (typeof window !== 'undefined') {
    window.__LSPILOT_STUDY__ = { SYS: SYS, wrongAnswers: wrongAnswers, isReview: isReview, pageText: pageText, selection: selection };
  }
  if (document.body) build();
})();
