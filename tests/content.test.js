"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadContent, element } = require("./harness");

test("exam mode stops the learning panel from loading", () => {
  const r = loadContent({ examMode: true, pathname: "/mod/quiz/attempt.php", body: element() });
  assert.equal(r.study, undefined);
  assert.equal(r.examEarlyExit, true);
});

test("tutor prompts exist and hint without giving the answer away", () => {
  const r = loadContent({ pathname: "/mod/book/view.php" });
  assert.ok(r.study);
  for (const key of ["explain", "hint", "summary", "flashcards", "similar", "mistakes"]) {
    assert.equal(typeof r.study.SYS[key], "string");
    assert.ok(r.study.SYS[key].length > 20, key);
  }
  assert.match(r.study.SYS.hint, /Do not reveal the answer/i);
  assert.match(r.study.SYS.explain, /Do not just state a final answer/i);
});

test("review.php is treated as a review page", () => {
  const r = loadContent({ pathname: "/mod/quiz/review.php" });
  assert.equal(r.study.isReview, true);
});

test("a lesson page is not a review page", () => {
  const r = loadContent({ pathname: "/mod/book/view.php" });
  assert.equal(r.study.isReview, false);
});

test("wrongAnswers collects incorrect Moodle questions", () => {
  const q1 = element({
    innerText: "Q1 body",
    querySelector(sel) {
      if (sel === ".qtext") return element({ innerText: "What is 2+2?" });
      if (sel === ".rightanswer") return element({ innerText: "The correct answer is 4" });
      return null;
    },
    querySelectorAll(sel) {
      if (sel.startsWith(".answer")) {
        return [element({ innerText: "3", closest() { return element({ innerText: "3" }); } })];
      }
      return [];
    },
  });
  const r = loadContent({
    pathname: "/mod/quiz/review.php",
    queryMap: { ".que.incorrect, .que.partiallycorrect": [q1] },
  });
  const rows = r.study.wrongAnswers();
  assert.equal(rows.length, 1);
  assert.match(rows[0], /What is 2\+2\?/);
  assert.match(rows[0], /My answer: 3/);
  assert.match(rows[0], /The correct answer is 4/);
});

test("wrongAnswers is empty when every question is correct", () => {
  const r = loadContent({
    pathname: "/mod/quiz/review.php",
    queryMap: { ".que.incorrect, .que.partiallycorrect": [] },
  });
  assert.equal(r.study.wrongAnswers().length, 0);
});
