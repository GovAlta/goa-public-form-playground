import { describe, it, expect } from "vitest";
import { EMPTY_FORM, formReducer, type FormState } from "./form-state";

const withDocuments = (documents: Partial<FormState["documents"]>): FormState => ({
  ...EMPTY_FORM,
  documents: { proofOfIncome: [], ...documents },
});

describe("submitting", () => {
  // A submitted application with no reference locks every page and shows nothing to
  // write down.
  it("records the time and the reference together", () => {
    const after = formReducer(EMPTY_FORM, {
      type: "submit",
      at: "2026-08-14T10:00:00.000Z",
      reference: "FSA-4KMQ-7XTC",
    });

    expect(after.submittedAt).toBe("2026-08-14T10:00:00.000Z");
    expect(after.reference).toBe("FSA-4KMQ-7XTC");
  });

  // Keeping the reference would leave every editable page redirecting to a
  // confirmation for an application that no longer exists.
  it("clears the submission when starting a new application", () => {
    const submitted = formReducer(EMPTY_FORM, {
      type: "submit",
      at: "2026-08-14T10:00:00.000Z",
      reference: "FSA-4KMQ-7XTC",
    });

    const after = formReducer(submitted, { type: "reset" });

    expect(after.submittedAt).toBeNull();
    expect(after.reference).toBeNull();
  });
});

describe("saving a branching section", () => {
  it("replaces the documents answers rather than merging them", () => {
    const before = withDocuments({
      hasOtherIncome: "yes",
      otherIncomeDetail: "Weekend shifts at a cafe",
    });

    const after = formReducer(before, {
      type: "save-documents",
      answers: { proofOfIncome: [], hasOtherIncome: "no" },
    });

    expect(after.documents.hasOtherIncome).toBe("no");
    expect(after.documents.otherIncomeDetail).toBeUndefined();
  });

  it("already replaces the screener answers, for the same reason", () => {
    const before: FormState = {
      ...EMPTY_FORM,
      eligibility: {
        age: "yes",
        residency: "yes",
        otherSupport: "yes",
        otherSupportDetail: "AISH",
      },
    };

    const after = formReducer(before, {
      type: "save-eligibility",
      answers: { age: "yes", residency: "yes", otherSupport: "no" },
    });

    expect(after.eligibility.otherSupportDetail).toBeUndefined();
  });
});

describe("children", () => {
  const child = {
    id: "c1",
    firstName: "Ava",
    lastName: "Chen",
    dateOfBirth: "2018-03-12",
    livesWithYou: "no" as const,
    livingArrangement: "Their grandmother",
  };

  it("replaces a child wholesale, so a pruned answer does not survive the update", () => {
    const before: FormState = { ...EMPTY_FORM, children: [child] };

    const after = formReducer(before, {
      type: "update-child",
      id: "c1",
      child: { ...child, livesWithYou: "yes", livingArrangement: undefined },
    });

    expect(after.children[0].livingArrangement).toBeUndefined();
  });

  it("removes by id, leaving the others in place", () => {
    const other = { ...child, id: "c2", firstName: "Noor" };
    const before: FormState = { ...EMPTY_FORM, children: [child, other] };

    const after = formReducer(before, { type: "remove-child", id: "c1" });

    expect(after.children.map((c) => c.id)).toEqual(["c2"]);
  });
});
