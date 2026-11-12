"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadExamMode, element } = require("./harness");

test("a normal Moodle page does not trigger exam mode", () => {
  const r = loadExamMode({ pathname: "/course/view.php" });
  assert.equal(r.exam, false);
  assert.equal(r.reasons.length, 0);
  assert.equal(r.created.length, 0);
});

test("a quiz review page stays in learning mode", () => {
  const r = loadExamMode({ pathname: "/mod/quiz/review.php" });
  assert.equal(r.exam, false);
  assert.equal(r.reasons.length, 0);
});

test("a graded quiz attempt turns the assistant off", () => {
  const r = loadExamMode({ pathname: "/mod/quiz/attempt.php" });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("graded-quiz-attempt"));
  assert.equal(r.created.length, 1);
  assert.equal(r.created[0].id, "lspilot-exam-banner");
  assert.match(r.created[0].textContent, /Mod examen|Exam mode/i);
});

test("a timed quiz attempt is flagged separately", () => {
  const r = loadExamMode({
    pathname: "/mod/quiz/attempt.php",
    queryMap: { "#quiz-timer, #quiz-time-left, .quiz-timer-inner": element({ id: "quiz-timer" }) },
  });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("timed-quiz-attempt"));
  assert.ok(!r.reasons.includes("graded-quiz-attempt"));
});

test("a teacher opt-in meta keeps the assistant on during an attempt", () => {
  const r = loadExamMode({
    pathname: "/mod/quiz/attempt.php",
    queryMap: { 'meta[name="lspilot-allow"]': element({ tagName: "META" }) },
  });
  assert.equal(r.exam, false);
});

test("a teacher opt-out meta disables the assistant", () => {
  const r = loadExamMode({
    pathname: "/mod/page/view.php",
    queryMap: { 'meta[name="lspilot-disable"],meta[name="exam-lock"]': element({ tagName: "META" }) },
  });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("teacher-opt-out"));
});

test("a secure exam browser user agent is detected", () => {
  const r = loadExamMode({ pathname: "/course/view.php", userAgent: "Mozilla/5.0 SafeExamBrowser" });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("secure-exam-browser"));
});

test("a proctoring runtime global is detected", () => {
  const r = loadExamMode({ pathname: "/course/view.php", SafeExamBrowser: { version: "1" } });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("proctoring-runtime"));
});

test("proctoring plugin markup in the page is detected", () => {
  const r = loadExamMode({
    pathname: "/course/view.php",
    html: "<html><body>quizaccess_seb loaded</body></html>",
  });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("proctoring-plugin"));
});

test("a graded assignment submission path is detected", () => {
  const r = loadExamMode({ pathname: "/mod/assign/submission.php" });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("graded-submission"));
});

test("an iframe still records exam mode but does not paint a second banner", () => {
  const r = loadExamMode({ pathname: "/mod/quiz/attempt.php", isTop: false });
  assert.equal(r.exam, true);
  assert.ok(r.reasons.includes("graded-quiz-attempt"));
  assert.equal(r.created.length, 0);
});
