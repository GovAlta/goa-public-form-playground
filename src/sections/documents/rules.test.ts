import { describe, it, expect } from "vitest";
import type { DocumentAnswers, UploadedDocument } from "../../lib/form-state";
import {
  addDocument,
  DOCUMENT_STEPS,
  DOCUMENT_STEP_IDS,
  FIRST_DOCUMENT_STEP,
  firstIncompleteDocumentStep,
  isDocumentStep,
  isDocumentStepComplete,
  previousDocumentStep,
  pruneDocuments,
  removeDocument,
  resolveNextDocumentStep,
  toUploadedDocument,
} from "./rules";

const A_PAYSLIP = {
  id: "f1",
  name: "payslip.pdf",
  size: 24_000,
  type: "application/pdf",
};
const A_LETTER = { id: "f2", name: "letter.pdf", size: 8_000, type: "application/pdf" };

const EMPTY: DocumentAnswers = { proofOfIncome: [] };
const UPLOADED: DocumentAnswers = { proofOfIncome: [A_PAYSLIP] };

const SAID_NO: DocumentAnswers = { proofOfIncome: [A_PAYSLIP], hasOtherIncome: "no" };

const SAID_YES: DocumentAnswers = {
  proofOfIncome: [A_PAYSLIP],
  hasOtherIncome: "yes",
  otherIncomeDetail: "Weekend shifts at a cafe",
};

describe("the section's shape", () => {
  it("asks for the documents, then about other income, then what it is", () => {
    expect(DOCUMENT_STEP_IDS).toEqual([
      "proof-of-income",
      "other-income",
      "other-income-detail",
    ]);
    expect(FIRST_DOCUMENT_STEP).toBe("proof-of-income");
  });

  it("recognises its own step ids and rejects anything else", () => {
    expect(isDocumentStep("proof-of-income")).toBe(true);
    expect(isDocumentStep("income")).toBe(false);
    expect(isDocumentStep(undefined)).toBe(false);
  });

  it("walks back through the path taken, not the declared order", () => {
    expect(previousDocumentStep("other-income", SAID_NO)).toBe("proof-of-income");
    expect(previousDocumentStep("other-income-detail", SAID_YES)).toBe("other-income");
    expect(previousDocumentStep("proof-of-income", SAID_NO)).toBeNull();
  });
});

describe("the branch", () => {
  it("ends the section when there is no other income", () => {
    expect(resolveNextDocumentStep("other-income", SAID_NO)).toEqual({ outcome: "done" });
  });

  it("asks what the other income is when there is some", () => {
    const unanswered: DocumentAnswers = { ...SAID_YES, otherIncomeDetail: undefined };
    expect(resolveNextDocumentStep("other-income", unanswered)).toEqual({
      question: "other-income-detail",
    });
  });

  it("skips questions already answered, so a change goes straight back", () => {
    expect(resolveNextDocumentStep("proof-of-income", SAID_NO)).toEqual({
      outcome: "done",
    });
  });

  it("stops at what a changed answer newly opened", () => {
    const flipped: DocumentAnswers = { ...SAID_NO, hasOtherIncome: "yes" };
    expect(resolveNextDocumentStep("proof-of-income", flipped)).toEqual({
      question: "other-income-detail",
    });
  });
});

describe("pruning answers the path no longer reaches", () => {
  it("drops the detail once the answer goes back to no", () => {
    const flipped: DocumentAnswers = { ...SAID_YES, hasOtherIncome: "no" };
    expect(pruneDocuments(flipped).otherIncomeDetail).toBeUndefined();
  });

  it("keeps it while the answer is still yes", () => {
    expect(pruneDocuments(SAID_YES).otherIncomeDetail).toBe("Weekend shifts at a cafe");
  });

  it("never drops the uploaded files, which no answer can un-ask", () => {
    const flipped: DocumentAnswers = { ...SAID_YES, hasOtherIncome: "no" };
    expect(pruneDocuments(flipped).proofOfIncome).toEqual([A_PAYSLIP]);
  });
});

describe("proof of income", () => {
  it("is unfinished until at least one file is there", () => {
    expect(isDocumentStepComplete("proof-of-income", EMPTY)).toBe(false);
    expect(isDocumentStepComplete("proof-of-income", UPLOADED)).toBe(true);
  });

  it("accepts more than one file, because income can come from more than one place", () => {
    const two: DocumentAnswers = { proofOfIncome: [A_PAYSLIP, A_LETTER] };
    expect(isDocumentStepComplete("proof-of-income", two)).toBe(true);
  });

  it("names the file, its size and its type, so a card can be drawn from the record", () => {
    const doc = toUploadedDocument("abc", {
      name: "payslip.pdf",
      size: 24_000,
      type: "application/pdf",
    });
    expect(doc).toEqual({
      id: "abc",
      name: "payslip.pdf",
      size: 24_000,
      type: "application/pdf",
    });
  });

  it("removes by id rather than by position, because the list re-renders", () => {
    const two: DocumentAnswers = { proofOfIncome: [A_PAYSLIP, A_LETTER] };
    expect(removeDocument(two.proofOfIncome, "f1")).toEqual([A_LETTER]);
    expect(removeDocument(two.proofOfIncome, "nope")).toEqual(two.proofOfIncome);
  });
});

describe("other income", () => {
  it("is unfinished until the question is answered either way", () => {
    expect(isDocumentStepComplete("other-income", UPLOADED)).toBe(false);
    expect(
      isDocumentStepComplete("other-income", { ...UPLOADED, hasOtherIncome: "no" }),
    ).toBe(true);
    expect(
      isDocumentStepComplete("other-income", { ...UPLOADED, hasOtherIncome: "yes" }),
    ).toBe(true);
  });
});

describe("resuming the section", () => {
  it("lands on the first thing still needing an answer", () => {
    expect(firstIncompleteDocumentStep(EMPTY)).toBe("proof-of-income");
    expect(firstIncompleteDocumentStep(UPLOADED)).toBe("other-income");
    expect(firstIncompleteDocumentStep(SAID_NO)).toBeNull();
    expect(firstIncompleteDocumentStep(SAID_YES)).toBeNull();
  });

  it("lands on the detail when the answer opened it and nothing filled it", () => {
    const unanswered: DocumentAnswers = { ...SAID_YES, otherIncomeDetail: undefined };
    expect(firstIncompleteDocumentStep(unanswered)).toBe("other-income-detail");
  });

  it("does not hold the section open for a question nobody was asked", () => {
    expect(isDocumentStepComplete("other-income-detail", SAID_NO)).toBe(true);
  });
});

describe("what the pages collect between them", () => {
  it("covers every answer this section owns, so none is unreachable", () => {
    const onPages = DOCUMENT_STEP_IDS.flatMap((id) => DOCUMENT_STEPS[id].fields);
    expect(onPages).toEqual(["proofOfIncome", "hasOtherIncome", "otherIncomeDetail"]);
  });
});

describe("adding a document", () => {
  const existing: UploadedDocument = {
    id: "1",
    name: "payslip.pdf",
    size: 1024,
    type: "application/pdf",
  };
  const uploaded: UploadedDocument = {
    id: "2",
    name: "t4.pdf",
    size: 2048,
    type: "application/pdf",
  };

  it("keeps what is already there when the page takes several", () => {
    expect(addDocument([existing], uploaded, true)).toEqual([existing, uploaded]);
  });

  it("replaces what is there when the page takes one", () => {
    expect(addDocument([existing], uploaded, false)).toEqual([uploaded]);
  });

  it("adds the first document either way", () => {
    expect(addDocument([], uploaded, true)).toEqual([uploaded]);
    expect(addDocument([], uploaded, false)).toEqual([uploaded]);
  });
});
