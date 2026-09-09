import { describe, it, expect } from "vitest";
import type { ChildRecord } from "../../lib/form-state";
import {
  CHILD_STEPS,
  CHILD_STEP_IDS,
  FIRST_CHILD_STEP,
  childLabel,
  childrenComplete,
  emptyChild,
  firstIncompleteChildStep,
  isChildComplete,
  isChildStep,
  isChildStepComplete,
  previousChildStep,
  pruneChild,
  reachableChildSteps,
  resolveNextChildStep,
} from "./rules";

const LIVES_WITH: ChildRecord = {
  id: "c1",
  firstName: "Ava",
  lastName: "Chen",
  dateOfBirth: "2018-03-12",
  livesWithYou: "yes",
};

const LIVES_ELSEWHERE: ChildRecord = {
  id: "c2",
  firstName: "Noor",
  lastName: "Haddad",
  dateOfBirth: "2015-11-02",
  livesWithYou: "no",
  livingArrangement: "With their grandmother in Calgary",
};

describe("the sub-flow's shape", () => {
  it("is four questions, in the order they are asked", () => {
    expect(CHILD_STEP_IDS).toEqual([
      "name",
      "date-of-birth",
      "lives-with-you",
      "living-arrangement",
    ]);
  });

  it("starts at the name", () => {
    expect(FIRST_CHILD_STEP).toBe("name");
  });

  it("recognises its own step ids and rejects anything else", () => {
    expect(isChildStep("date-of-birth")).toBe(true);
    expect(isChildStep("check")).toBe(false);
    expect(isChildStep(undefined)).toBe(false);
  });

  it("walks back through the path actually taken, not the declared order", () => {
    expect(previousChildStep("living-arrangement", LIVES_ELSEWHERE)).toBe(
      "lives-with-you",
    );
    expect(previousChildStep("date-of-birth", LIVES_WITH)).toBe("name");
    expect(previousChildStep("name", LIVES_WITH)).toBeNull();
  });

  it("personalises each heading once the child has a name", () => {
    expect(CHILD_STEPS["date-of-birth"].heading(LIVES_WITH)).toContain("Ava");
    expect(CHILD_STEPS["date-of-birth"].heading(emptyChild("x"))).not.toContain(
      "undefined",
    );
  });
});

describe("the branch", () => {
  it("skips the living arrangement when the child lives with you", () => {
    expect(resolveNextChildStep("lives-with-you", LIVES_WITH)).toEqual({
      outcome: "done",
    });
  });

  it("asks the living arrangement when the child does not", () => {
    const unanswered: ChildRecord = { ...LIVES_ELSEWHERE, livingArrangement: undefined };
    expect(resolveNextChildStep("lives-with-you", unanswered)).toEqual({
      question: "living-arrangement",
    });
  });

  it("ends once every question on the path is answered", () => {
    expect(resolveNextChildStep("living-arrangement", LIVES_ELSEWHERE)).toEqual({
      outcome: "done",
    });
  });

  it("skips questions already answered, so a change goes straight back to the check", () => {
    expect(resolveNextChildStep("name", LIVES_WITH)).toEqual({ outcome: "done" });
  });

  it("stops at what a changed answer newly opened", () => {
    const flipped: ChildRecord = { ...LIVES_WITH, livesWithYou: "no" };
    expect(resolveNextChildStep("name", flipped)).toEqual({
      question: "living-arrangement",
    });
  });

  it("counts only the steps on the path actually taken", () => {
    expect([...reachableChildSteps(LIVES_WITH)]).toEqual([
      "name",
      "date-of-birth",
      "lives-with-you",
    ]);
    expect([...reachableChildSteps(LIVES_ELSEWHERE)]).toContain("living-arrangement");
  });
});

describe("pruning answers the path no longer reaches", () => {
  it("drops a living arrangement once the child is said to live with you", () => {
    const flipped: ChildRecord = { ...LIVES_ELSEWHERE, livesWithYou: "yes" };
    expect(pruneChild(flipped).livingArrangement).toBeUndefined();
  });

  it("keeps it while the child still lives elsewhere", () => {
    expect(pruneChild(LIVES_ELSEWHERE).livingArrangement).toBe(
      "With their grandmother in Calgary",
    );
  });

  it("never drops the id, which is what edit and remove are keyed on", () => {
    const flipped: ChildRecord = { ...LIVES_ELSEWHERE, livesWithYou: "yes" };
    expect(pruneChild(flipped).id).toBe("c2");
  });
});

describe("when a child counts as finished", () => {
  it("is finished once every question on its own path is answered", () => {
    expect(isChildComplete(LIVES_WITH)).toBe(true);
    expect(isChildComplete(LIVES_ELSEWHERE)).toBe(true);
  });

  it("is unfinished while the branch it opened is unanswered", () => {
    expect(isChildComplete({ ...LIVES_ELSEWHERE, livingArrangement: undefined })).toBe(
      false,
    );
  });

  it("is unfinished the moment it is added", () => {
    expect(isChildComplete(emptyChild("new"))).toBe(false);
  });

  it("judges a page by its own rules", () => {
    expect(isChildStepComplete("name", LIVES_WITH)).toBe(true);
    expect(isChildStepComplete("name", { ...LIVES_WITH, lastName: "" })).toBe(false);
    // Off-path pages are vacuously fine: a hidden question cannot be unanswered.
    expect(isChildStepComplete("living-arrangement", LIVES_WITH)).toBe(true);
  });

  it("rejects a birth date in the future, the same as the applicant's own", () => {
    const nextYear = `${new Date().getFullYear() + 1}-01-01`;
    expect(
      isChildStepComplete("date-of-birth", { ...LIVES_WITH, dateOfBirth: nextYear }),
    ).toBe(false);
  });

  it("resumes at the first question still needing an answer", () => {
    expect(firstIncompleteChildStep(emptyChild("new"))).toBe("name");
    expect(
      firstIncompleteChildStep({
        ...emptyChild("new"),
        firstName: "Ava",
        lastName: "Chen",
      }),
    ).toBe("date-of-birth");
    expect(firstIncompleteChildStep(LIVES_WITH)).toBeNull();
  });
});

describe("the section as a whole", () => {
  it("is unfinished with nobody added, because the question was not answered", () => {
    expect(childrenComplete([])).toBe(false);
  });

  it("is unfinished while any one child is", () => {
    expect(childrenComplete([LIVES_WITH, emptyChild("half")])).toBe(false);
  });

  it("is finished when every child is", () => {
    expect(childrenComplete([LIVES_WITH, LIVES_ELSEWHERE])).toBe(true);
  });
});

describe("naming a child in the list", () => {
  it("uses the full name, which is the field the list is read by", () => {
    expect(childLabel(LIVES_WITH)).toBe("Ava Chen");
  });

  it("still names a child who has only been half added", () => {
    expect(childLabel(emptyChild("new"))).toBe("Child with no name yet");
    expect(childLabel({ ...emptyChild("new"), firstName: "Ava" })).toBe("Ava");
  });
});

describe("what the pages collect between them", () => {
  it("covers every field the pages collect, so no answer is unreachable", () => {
    const onPages = CHILD_STEP_IDS.flatMap((id) => CHILD_STEPS[id].fields);
    expect(onPages).toEqual([
      "firstName",
      "lastName",
      "dateOfBirth",
      "livesWithYou",
      "livingArrangement",
    ]);
  });
});

describe("a newly added child", () => {
  it("carries the id it was given and nothing else", () => {
    const child = emptyChild("abc");
    expect(child.id).toBe("abc");
    expect(child.firstName).toBe("");
    expect(child.livesWithYou).toBeUndefined();
  });
});
