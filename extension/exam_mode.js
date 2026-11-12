/* LSPilot exam-mode detection. When a graded or timed assessment is detected, the assistant stays off and shows a visible banner. */
(function () {
  'use strict';
  function detect() {
    const reasons = [];
    const ua = navigator.userAgent || '';
    if (/SEB|SafeExamBrowser|LockDown|Respondus|Examplify|Inspera/i.test(ua)) reasons.push('secure-exam-browser');
    if (window.SafeExamBrowser || window.__PROCTORIO__ || window.Honorlock) reasons.push('proctoring-runtime');
    const html = document.documentElement ? document.documentElement.innerHTML.slice(0, 400000) : '';
    if (/proctorio|honorlock|respondus|proctoru|examity|quizaccess_proctoring|quizaccess_seb|proctoringplugin/i.test(html)) reasons.push('proctoring-plugin');
    if (document.querySelector('meta[name="lspilot-disable"],meta[name="exam-lock"]')) reasons.push('teacher-opt-out');
    const path = location.pathname;
    if (/\/mod\/quiz\/attempt\.php/.test(path)) {
      const timer = document.querySelector('#quiz-timer, #quiz-time-left, .quiz-timer-inner');
      const practice = document.querySelector('meta[name="lspilot-allow"]'); // teacher explicitly allows the assistant
      if (!practice) reasons.push(timer ? 'timed-quiz-attempt' : 'graded-quiz-attempt');
    }
    if (/\/mod\/(assign|exam)\/.*(submission|attempt)/.test(path)) reasons.push('graded-submission');
    return reasons;
  }
  function banner() {
    if (document.getElementById('lspilot-exam-banner')) return;
    const b = document.createElement('div');
    b.id = 'lspilot-exam-banner';
    b.textContent = 'LSPilot · Mod examen – asistentul este oprit (Exam mode – assistant is off)';
    b.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#b91c1c;color:#fff;font:600 13px system-ui;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    (document.body || document.documentElement).appendChild(b);
  }
  const reasons = detect();
  window.__LSPILOT_EXAM_MODE__ = reasons.length > 0;
  window.__LSPILOT_EXAM_REASONS__ = reasons;
  if (reasons.length && window === window.top) banner();
})();
