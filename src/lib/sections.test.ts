import { describe, it, expect } from "vitest";
import { EMPTY_FORM, type FormState } from "./form-state";
import { STEP_IDS as ELIGIBILITY_STEP_IDS } from "./eligibility";
import { ABOUT_YOU_STEP_IDS } from "./about-you";
import { DOCUMENT_STEP_IDS } from "./documents";
import { CHILD_STEP_IDS } from "./your-children";
import {
  SECTIONS,
  sectionById,
  sectionStatus,
  canSubmit,
  completedCount,
  incompleteSections,
  isComplete,
  isConfirmed,
} from "./sections";

const passedScreener: FormState["eligibility"] = {
  age: "yes",
  residency: "yes",
  otherSupport: "no",
};

const completeAboutYou: FormState["aboutYou"] = {
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1990-01-01",
  phone: "7801234567",
  street: "123 Main Street",
  city: "Edmonton",
  province: "Alberta",
  postalCode: "T5J 2N9",
};

const state = (over: Partial<FormState> = {}): FormState => ({ ...EMPTY_FORM, ...over });

/** Every task checked off, for the cases that are about the answers rather than this. */
const ALL_CONFIRMED: FormState["confirmed"] = [
  "eligibility",
  "about-you",
  "your-children",
  "documents",
];

describe("locking", () => {
  it("lets a person start the screener straight away", () => {
    expect(sectionStatus(sectionById("eligibility"), state())).toBe("not-started");
  });

  it("keeps the rest of the application shut until the screener passes", () => {
    const fresh = state();
    for (const id of ["about-you", "your-children", "documents"] as const) {
      expect(sectionStatus(sectionById(id), fresh)).toBe("cannot-start");
    }
  });

  it("opens the rest once the screener passes", () => {
    const passed = state({ eligibility: passedScreener });
    for (const id of ["about-you", "your-children", "documents"] as const) {
      expect(sectionStatus(sectionById(id), passed)).toBe("not-started");
    }
  });

  it("keeps the rest shut when the screener finished but failed", () => {
    const failed = state({ eligibility: { age: "no" } });
    expect(sectionStatus(sectionById("about-you"), failed)).toBe("cannot-start");
  });

  // Locked has to win. A section that is both unreachable and half-answered should
  // never invite the person in, whatever is stored against it.
  it("reports locked even when the section already holds answers", () => {
    const odd = state({ eligibility: { age: "no" }, aboutYou: completeAboutYou });
    expect(sectionStatus(sectionById("about-you"), odd)).toBe("cannot-start");
  });
});

describe("section progress", () => {
  it("moves the screener from not started to in progress to completed", () => {
    const section = sectionById("eligibility");
    expect(sectionStatus(section, state())).toBe("not-started");
    expect(sectionStatus(section, state({ eligibility: { age: "yes" } }))).toBe("in-progress");
    expect(
      sectionStatus(section, state({ eligibility: passedScreener, confirmed: ["eligibility"] })),
    ).toBe("completed");
  });

  it("counts a failed screener as completed, because there is nothing left to do", () => {
    // The not-eligible page is the screener's other terminal and confirms the task on
    // the way through, which is why this state is reachable at all.
    expect(
      sectionStatus(
        sectionById("eligibility"),
        state({ eligibility: { age: "no" }, confirmed: ["eligibility"] }),
      ),
    ).toBe("completed");
  });

  it("holds About you at in progress until every required answer is there", () => {
    const partial = state({
      eligibility: passedScreener,
      aboutYou: { firstName: "Ada", lastName: "Lovelace" },
    });
    expect(sectionStatus(sectionById("about-you"), partial)).toBe("in-progress");

    const complete = state({
      eligibility: passedScreener,
      aboutYou: completeAboutYou,
      confirmed: ["about-you"],
    });
    expect(sectionStatus(sectionById("about-you"), complete)).toBe("completed");
  });

  it("holds Your children at in progress while a child is half added", () => {
    // Adding a child creates the record straight away, so a list with a row in it
    // can still be a list of unfinished work. Counting rows would call this done
    // and let someone submit an application with an unfinished child in it.
    const halfAdded = state({
      eligibility: passedScreener,
      children: [{ id: "1", firstName: "Kit", lastName: "Lovelace", dateOfBirth: "2015-06-02" }],
    });
    expect(sectionStatus(sectionById("your-children"), halfAdded)).toBe("in-progress");
  });

  it("completes Your children once every child's own path is answered", () => {
    const done = state({
      eligibility: passedScreener,
      children: [
        {
          id: "1",
          firstName: "Kit",
          lastName: "Lovelace",
          dateOfBirth: "2015-06-02",
          livesWithYou: "yes",
        },
      ],
      confirmed: ["your-children"],
    });
    expect(sectionStatus(sectionById("your-children"), done)).toBe("completed");
  });

  it("does not need a living arrangement from a child who lives with you", () => {
    const elsewhere = state({
      eligibility: passedScreener,
      children: [
        {
          id: "1",
          firstName: "Kit",
          lastName: "Lovelace",
          dateOfBirth: "2015-06-02",
          livesWithYou: "no",
        },
      ],
    });
    expect(sectionStatus(sectionById("your-children"), elsewhere)).toBe("in-progress");
  });

  it("needs the follow-up answered before Documents counts as done", () => {
    const base = state({
      eligibility: passedScreener,
      documents: {
        proofOfIncome: [{ id: "1", name: "payslip.pdf", size: 1024, type: "application/pdf" }],
        hasOtherIncome: "yes",
      },
    });
    expect(sectionStatus(sectionById("documents"), base)).toBe("in-progress");

    const answered = state({
      eligibility: passedScreener,
      documents: { ...base.documents, otherIncomeDetail: "Weekend work" },
      confirmed: ["documents"],
    });
    expect(sectionStatus(sectionById("documents"), answered)).toBe("completed");
  });

  it("does not need the follow-up when the answer was no", () => {
    const done = state({
      eligibility: passedScreener,
      documents: {
        proofOfIncome: [{ id: "1", name: "payslip.pdf", size: 1024, type: "application/pdf" }],
        hasOtherIncome: "no",
      },
      confirmed: ["documents"],
    });
    expect(sectionStatus(sectionById("documents"), done)).toBe("completed");
  });
});

/*
 * Completed is two conditions, not one, and these are the tests for the second.
 *
 * A task finishes on its own check-answers page: answering the last question takes
 * you there, and pressing Continue there is what completes the task. So a task can be
 * fully answered and still not done, which is the case worth pinning — it is the one
 * that looks like a bug to anyone who assumes the answers decide.
 */
describe("confirming a task", () => {
  const answeredAboutYou = state({
    eligibility: passedScreener,
    aboutYou: completeAboutYou,
  });

  it("holds a fully answered task at in progress until it has been checked", () => {
    expect(sectionById("about-you").isAnswered(answeredAboutYou)).toBe(true);
    expect(sectionStatus(sectionById("about-you"), answeredAboutYou)).toBe("in-progress");
  });

  it("completes it once it has", () => {
    const checked = state({ ...answeredAboutYou, confirmed: ["about-you"] });
    expect(sectionStatus(sectionById("about-you"), checked)).toBe("completed");
  });

  it("is necessary and never sufficient", () => {
    // Confirming a task whose answers are not all there does not complete it. This is
    // what stops the flag becoming a second source of truth that can drift: it can
    // only ever hold a task back, never carry one over the line on its own.
    const half = state({
      eligibility: passedScreener,
      aboutYou: { firstName: "Ada", lastName: "Lovelace" },
      confirmed: ["about-you"],
    });
    expect(isConfirmed("about-you", half)).toBe(true);
    expect(sectionStatus(sectionById("about-you"), half)).toBe("in-progress");
  });

  it("survives a change that reopens a question, without re-confirming", () => {
    // Someone finishes Income and documents, then changes "any other income?" from no
    // to yes. That opens a question they have not answered, so the answers are
    // incomplete and the row drops back — with nothing anywhere clearing the flag.
    const finished = state({
      eligibility: passedScreener,
      documents: {
        proofOfIncome: [{ id: "1", name: "payslip.pdf", size: 1024, type: "application/pdf" }],
        hasOtherIncome: "no",
      },
      confirmed: ["documents"],
    });
    expect(sectionStatus(sectionById("documents"), finished)).toBe("completed");

    const reopened = state({
      ...finished,
      documents: { ...finished.documents, hasOtherIncome: "yes" },
    });
    expect(sectionStatus(sectionById("documents"), reopened)).toBe("in-progress");

    // And answering the newly opened question brings it back, without the person
    // being made to walk the check page a second time.
    const reanswered = state({
      ...reopened,
      documents: { ...reopened.documents, otherIncomeDetail: "Weekend work" },
    });
    expect(sectionStatus(sectionById("documents"), reanswered)).toBe("completed");
  });

  it("is the same rule the review page and the task list both read", () => {
    const checked = state({ ...answeredAboutYou, confirmed: ["about-you"] });
    expect(isComplete(sectionById("about-you"), checked)).toBe(true);
    expect(incompleteSections(checked).map((s) => s.id)).not.toContain("about-you");
    expect(incompleteSections(answeredAboutYou).map((s) => s.id)).toContain("about-you");
  });
});

describe("submitting", () => {
  const everything = state({
    eligibility: passedScreener,
    aboutYou: completeAboutYou,
    children: [
      {
        id: "1",
        firstName: "Kit",
        lastName: "Lovelace",
        dateOfBirth: "2015-06-02",
        livesWithYou: "yes",
      },
    ],
    documents: {
      proofOfIncome: [{ id: "1", name: "payslip.pdf", size: 1024, type: "application/pdf" }],
      hasOtherIncome: "no",
    },
    confirmed: ALL_CONFIRMED,
  });

  it("cannot submit an empty application", () => {
    expect(canSubmit(state())).toBe(false);
  });

  it("cannot submit with one section left", () => {
    const nearly = state({ ...everything, children: [] });
    expect(canSubmit(nearly)).toBe(false);
  });

  it("can submit once every section is complete", () => {
    expect(canSubmit(everything)).toBe(true);
  });

  it("cannot submit an application whose last task was never checked", () => {
    // Every answer is present. The task list still calls Income and documents
    // unfinished, and the review page has to agree with it — a page offering to send
    // an application the task list calls unfinished is the two disagreeing in front
    // of the person, with no way for them to tell which is right.
    const unchecked = state({
      ...everything,
      confirmed: ["eligibility", "about-you", "your-children"],
    });
    expect(sectionById("documents").isAnswered(unchecked)).toBe(true);
    expect(canSubmit(unchecked)).toBe(false);
    expect(incompleteSections(unchecked).map((s) => s.id)).toEqual(["documents"]);
  });

  it("counts completed sections for the progress line", () => {
    expect(completedCount(state())).toBe(0);
    expect(completedCount(state({ eligibility: passedScreener, confirmed: ["eligibility"] }))).toBe(
      1,
    );
    expect(completedCount(everything)).toBe(SECTIONS.length);
  });

  // The review page tells someone who arrives unfinished which parts are outstanding
  // by name. Asserting the names rather than the count is the point: a list of the
  // right length naming the wrong sections is the failure that would actually happen,
  // and it would send a person to a section they had already finished.
  it("names every unfinished section, in task list order", () => {
    expect(incompleteSections(state()).map((s) => s.id)).toEqual([
      "eligibility",
      "about-you",
      "your-children",
      "documents",
    ]);
  });

  it("names only the section that is actually unfinished", () => {
    const nearly = state({ ...everything, children: [] });
    expect(incompleteSections(nearly).map((s) => s.id)).toEqual(["your-children"]);
  });

  it("has nothing outstanding once the application is complete", () => {
    expect(incompleteSections(everything)).toEqual([]);
  });
});

describe("the check route", () => {
  /*
   * Every section registers /<section>/check beside a dynamic :step route. React
   * Router ranks the static segment higher, so a question whose id was "check" would
   * not break the check page — it would become UNREACHABLE, silently, and look like a
   * question that had been deleted rather than a routing collision.
   *
   * Cheap to guard, and the failure it prevents is one nobody would diagnose from the
   * symptom. Your children is included because its sub-flow has the same shape one
   * level down: /your-children/:childId/check beside /your-children/:childId/:step.
   */
  it("cannot be shadowed by a question with the same id", () => {
    expect(ELIGIBILITY_STEP_IDS).not.toContain("check");
    expect(ABOUT_YOU_STEP_IDS).not.toContain("check");
    expect(DOCUMENT_STEP_IDS).not.toContain("check");
    expect(CHILD_STEP_IDS).not.toContain("check");
  });

  it("is expected by every task that has not opted out", () => {
    // The switch and the routing have to stay in step: a task with hasCheckPage true
    // and no check route can never be completed, which shows up as a row stuck at
    // "In progress" whatever the person does. All four have one today.
    expect(SECTIONS.filter((s) => s.hasCheckPage).map((s) => s.id)).toEqual([
      "eligibility",
      "about-you",
      "your-children",
      "documents",
    ]);
  });
});

describe("the registry itself", () => {
  it("throws on an unknown section rather than returning undefined", () => {
    // @ts-expect-error deliberately passing an id that is not in the union
    expect(() => sectionById("nope")).toThrow();
  });
});
