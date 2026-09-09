import { describe, it, expect } from "vitest";
import {
  resolveNext,
  reachable,
  pruneUnreachable,
  remainingQuestions,
  screenerOutcome,
  firstUnansweredStep,
} from "./rules";
import type { EligibilityAnswers } from "../../lib/form-state";

describe("walking forward", () => {
  it("goes to the next question when the gate is passed", () => {
    expect(resolveNext("age", { age: "yes" })).toEqual({ question: "residency" });
  });

  it("ends the screener when a gate fails", () => {
    expect(resolveNext("age", { age: "no" })).toEqual({ outcome: "ineligible" });
  });

  it("fails on the second gate too, not just the first", () => {
    expect(resolveNext("residency", { age: "yes", residency: "no" })).toEqual({
      outcome: "ineligible",
    });
  });

  it("skips the follow-up when the answer does not call for it", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "no",
    };
    expect(resolveNext("otherSupport", answers)).toEqual({ outcome: "review" });
  });

  it("opens the follow-up when the answer does call for it", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "yes",
    };
    expect(resolveNext("otherSupport", answers)).toEqual({
      question: "otherSupportDetail",
    });
  });
});

describe("changing an answer from the review page", () => {
  const completed: EligibilityAnswers = {
    age: "yes",
    residency: "yes",
    otherSupport: "no",
  };

  it("goes straight back to review when the change opens nothing new", () => {
    expect(resolveNext("age", completed)).toEqual({ outcome: "review" });
  });

  it("stops at the newly opened question when a change reveals one", () => {
    const changed: EligibilityAnswers = { ...completed, otherSupport: "yes" };
    expect(resolveNext("otherSupport", changed)).toEqual({
      question: "otherSupportDetail",
    });
  });

  it("routes to a different outcome when a change flips a gate", () => {
    const changed: EligibilityAnswers = { ...completed, age: "no" };
    expect(resolveNext("age", changed)).toEqual({ outcome: "ineligible" });
  });

  it("counts the questions a change newly opened", () => {
    const changed: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "yes",
    };
    expect(remainingQuestions("otherSupport", changed)).toBe(1);
  });

  it("counts zero when a change opens nothing", () => {
    expect(remainingQuestions("age", completed)).toBe(0);
  });
});

describe("reachable", () => {
  it("includes only the steps on the answered path", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "no",
    };
    expect([...reachable(answers)]).toEqual(["age", "residency", "otherSupport"]);
  });

  it("stops at the first unanswered question", () => {
    expect([...reachable({ age: "yes" })]).toEqual(["age", "residency"]);
  });

  it("stops at a failed gate, so later steps are never reachable", () => {
    expect([...reachable({ age: "no", residency: "yes" })]).toEqual(["age"]);
  });
});

describe("pruneUnreachable", () => {
  it("drops an answer to a question the current path no longer asks", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "no",
      otherSupportDetail: "Some other program",
    };
    expect(pruneUnreachable(answers)).toEqual({
      age: "yes",
      residency: "yes",
      otherSupport: "no",
    });
  });

  it("keeps the answer when the path does still ask the question", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "yes",
      otherSupportDetail: "Some other program",
    };
    expect(pruneUnreachable(answers)).toEqual(answers);
  });

  it("discards a whole abandoned branch when an early gate flips", () => {
    const answers: EligibilityAnswers = {
      age: "no",
      residency: "yes",
      otherSupport: "yes",
      otherSupportDetail: "Some other program",
    };
    expect(pruneUnreachable(answers)).toEqual({ age: "no" });
  });
});

describe("screenerOutcome", () => {
  it("is null while the screener is unfinished", () => {
    expect(screenerOutcome({ age: "yes" })).toBeNull();
  });

  it("is null when nothing has been answered", () => {
    expect(screenerOutcome({})).toBeNull();
  });

  it("is ineligible when a gate failed", () => {
    expect(screenerOutcome({ age: "no" })).toBe("ineligible");
  });

  it("is review when the whole screener passed", () => {
    expect(screenerOutcome({ age: "yes", residency: "yes", otherSupport: "no" })).toBe(
      "review",
    );
  });

  it("requires the follow-up before it counts as finished", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "yes",
    };
    expect(screenerOutcome(answers)).toBeNull();
    expect(screenerOutcome({ ...answers, otherSupportDetail: "Some program" })).toBe(
      "review",
    );
  });
});

describe("where someone re-entering the screener lands", () => {
  it("starts at the beginning when nothing has been answered", () => {
    expect(firstUnansweredStep({})).toBe("age");
  });

  it("stops at the first question still unanswered", () => {
    expect(firstUnansweredStep({ age: "yes" })).toBe("residency");
    expect(firstUnansweredStep({ age: "yes", residency: "yes" })).toBe("otherSupport");
  });

  it("goes to a follow-up that the answers actually opened", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "yes",
    };
    expect(firstUnansweredStep(answers)).toBe("otherSupportDetail");
  });

  // Unanswered and unasked look identical unless you walk the branches: saying no ends
  // the screener, and the follow-up is never asked.
  it("is finished when the path ends, even though a question off the path is unanswered", () => {
    const answers: EligibilityAnswers = {
      age: "yes",
      residency: "yes",
      otherSupport: "no",
    };
    expect(answers.otherSupportDetail).toBeUndefined();
    expect(firstUnansweredStep(answers)).toBeNull();
  });

  it("is finished when every question on the path is answered", () => {
    expect(
      firstUnansweredStep({
        age: "yes",
        residency: "yes",
        otherSupport: "yes",
        otherSupportDetail: "Some program",
      }),
    ).toBeNull();
  });

  it("is finished when a gate failed, because there is nothing further to ask", () => {
    expect(firstUnansweredStep({ age: "no" })).toBeNull();
  });
});
