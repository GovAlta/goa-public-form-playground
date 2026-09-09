import { test, expect, type Page } from "@playwright/test";
import { SERVICE_NAME } from "../src/lib/service";
import { EMPTY_FORM, type FormState } from "../src/lib/form-state";

/**
 * One file, covering the wiring bugs a template ships while its unit tests are green:
 * answers leaking between pages, a draft lost on refresh, an error summary that does
 * not take focus, and routes a submitted application can still reach. Yours to delete,
 * with playwright.config.ts and the test:e2e script.
 */

const STORAGE_KEY = "goa-public-form-draft";

/** Click the label: the native input is hidden behind the component's own rendering. */
const chooseRadio = (page: Page, value: "yes" | "no") =>
  page.locator(`goa-radio-item[value="${value}"] label`).click();

/**
 * Walks a child as far as the branch. The date picker's day and year inputs carry
 * aria-label="", so they are reached by name: a workaround for a component defect.
 */
async function addChildUpToTheBranch(page: Page, first: string, last: string) {
  await page.getByRole("button", { name: /^Add a(nother)? child$/ }).click();

  await page.getByRole("textbox", { name: "First name" }).fill(first);
  await page.getByRole("textbox", { name: "Last name" }).fill(last);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await page.locator('input[name="month"]').click();
  await page.getByRole("option", { name: "March", exact: true }).click();
  await page.locator('input[name="day"]').fill("12");
  await page.locator('input[name="year"]').fill("2018");
  await page.getByRole("button", { name: "Save and continue" }).click();
}

/**
 * Answers the screener as someone eligible and passes through its check page, which
 * is what completes the task.
 */
async function passTheScreener(page: Page) {
  await page.getByRole("link", { name: "Check if you can apply" }).click();

  await expect(page.getByRole("heading", { name: "Are you 18 or older?" })).toBeVisible();
  await chooseRadio(page, "yes");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Do you live in Alberta?" })).toBeVisible();
  await chooseRadio(page, "yes");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Are you receiving support from another program?" }),
  ).toBeVisible();
  await chooseRadio(page, "no");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/eligibility\/check$/);
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // An empty draft is written rather than the key removed: nothing in storage is the
  // app's cue to load the sample application.
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: JSON.stringify(EMPTY_FORM) },
  );
  await page.reload();
});

test.describe("walking the flow", () => {
  test("the screener ends on its own check page, which completes it and unlocks the rest", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Check if you can apply" }).click();
    for (const answer of ["yes", "yes"] as const) {
      await chooseRadio(page, answer);
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await chooseRadio(page, "no");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/eligibility\/check$/);
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*In progress/ })).toBeVisible();

    await page.getByRole("link", { name: "Check if you can apply" }).click();
    await page.getByRole("button", { name: "Confirm and continue" }).click();

    await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "About you" })).toBeVisible();
  });

  test("an answer never pre-fills the next question", async ({ page }) => {
    // One route with a changing parameter reused the component, and the previous
    // answer carried forward.
    await page.getByRole("link", { name: "Check if you can apply" }).click();
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Do you live in Alberta?" })).toBeVisible();
    await expect(page.locator('goa-radio-item[value="yes"] input')).not.toBeChecked();
    await expect(page.locator('goa-radio-item[value="no"] input')).not.toBeChecked();
  });

  test("a branching answer opens the question it should", async ({ page }) => {
    await page.getByRole("link", { name: "Check if you can apply" }).click();
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Continue" }).click();
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Continue" }).click();

    // "Yes, I get support elsewhere" is the only answer that opens a fourth question.
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Which program is supporting you?" }),
    ).toBeVisible();
  });

  test("failing the screener ends the flow rather than continuing it", async ({ page }) => {
    await page.getByRole("link", { name: "Check if you can apply" }).click();
    await chooseRadio(page, "no");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/not-eligible/);

    // The not-eligible page completes the task too, or the row would stay In progress
    // forever.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();
  });
});

test.describe("coming back to a section", () => {
  test("a finished screener opens on its check page, not on a question nobody was asked", async ({
    page,
  }) => {
    // Said no to other support, so the follow-up was never asked.
    await seed(page, {
      ...COMPLETE_APPLICATION,
      eligibility: { age: "yes", residency: "yes", otherSupport: "no" },
    });
    await page.goto("/eligibility");

    await expect(page).toHaveURL(/\/eligibility\/check$/);
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Which program is supporting you?" }),
    ).toBeHidden();
    await expect(page.getByText("Which program is supporting you?")).toHaveCount(0);
  });

  test("failing a gate does not lead on to the questions behind it", async ({ page }) => {
    await seed(page, { ...COMPLETE_APPLICATION, eligibility: { age: "no" } });
    await page.goto("/eligibility");

    await expect(page).toHaveURL(/\/eligibility\/check$/);

    await expect(page.getByText("Are you 18 or older?")).toBeVisible();
    await expect(page.getByText("Do you live in Alberta?")).toHaveCount(0);
  });

  test("changing an answer from a task check page comes back to it", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/about-you/check");

    const change = page.getByRole("link", { name: "Change your address" });
    await expect(change).toHaveAttribute("href", "/about-you/address?from=task");
    await change.click();

    await expect(page.getByRole("heading", { name: "What is your address?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to your answers" })).toBeVisible();

    await page.getByRole("button", { name: "Save and return" }).click();
    await expect(page).toHaveURL(/\/about-you\/check$/);
  });

  test("changing the same answer from the whole-application review comes back to the review", async ({
    page,
  }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");

    await page.getByRole("link", { name: "Change your address" }).click();
    await expect(page).toHaveURL(/\/about-you\/address\?from=review$/);
    await expect(page.getByRole("link", { name: "Back to review" })).toBeVisible();

    await page.getByRole("button", { name: "Save and return" }).click();
    await expect(page).toHaveURL(/\/review$/);
  });

  // Template furniture: delete this test with the demo reset.
  test("the demo reset empties the application and says so on the task list", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();

    // The custom element and the button in its shadow root both answer to the name,
    // hence .first(). The items expose as buttons, not menuitems.
    await page.getByRole("button", { name: "Edna Mode" }).first().click();
    await page.getByRole("button", { name: /^Demo: clear answers/ }).click();

    await expect(
      page.getByRole("link", { name: /Check if you can apply.*Not started/ }),
    ).toBeVisible();

    // Gone from storage too, not just from the screen.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const saved = window.localStorage.getItem(key);
          return JSON.parse(saved ?? "{}").aboutYou?.firstName ?? null;
        }, STORAGE_KEY),
      )
      .toBeNull();
  });

  // Delete this test with the sample application.
  test("a browser with nothing saved starts part-finished, and clearing is reversible", async ({
    page,
  }) => {
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    await expect(
      page.getByRole("link", { name: /Check if you can apply.*Completed/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /About you.*In progress/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Your children.*Completed/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Income and documents.*Not started/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Edna Mode" }).first().click();
    await page.getByRole("button", { name: /^Demo: clear answers/ }).click();

    await expect(
      page.getByRole("link", { name: /Check if you can apply.*Not started/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^About you/ })).toHaveCount(0);

    // Clearing leaves nothing saved, which is what lets the next load fall back to the
    // sample.
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();

    await page.reload();
    await expect(page.getByRole("link", { name: /About you.*In progress/ })).toBeVisible();
  });

  test("an unfinished screener still resumes where the answers stop", async ({ page }) => {
    await seed(page, {
      ...COMPLETE_APPLICATION,
      eligibility: { age: "yes", residency: "yes", otherSupport: "yes" },
    });
    await page.goto("/eligibility");

    await expect(page).toHaveURL(/\/eligibility\/otherSupportDetail$/);
  });
});

test.describe("surviving a refresh", () => {
  test("answers are still there after reloading mid-application", async ({ page }) => {
    await passTheScreener(page);

    await page.getByRole("link", { name: "About you" }).click();
    await page.getByRole("textbox", { name: "First name" }).fill("Ada");
    await page.getByRole("textbox", { name: "Last name" }).fill("Lovelace");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page.getByRole("heading", { name: "What is your date of birth?" })).toBeVisible();

    await page.reload();
    await page.goto("/about-you/name");

    await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue("Ada");
    await expect(page.getByRole("textbox", { name: "Last name" })).toHaveValue("Lovelace");
  });

  test("a reload does not overwrite a saved draft with an empty one", async ({ page }) => {
    await passTheScreener(page);

    // Saving happens in an effect after the click resolves, so wait for the draft to
    // exist before reloading.
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toContain('"otherSupport":"no"');

    await page.reload();

    await expect(page.getByRole("link", { name: "About you" })).toBeVisible();

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toContain('"age":"yes"');
  });
});

test.describe("error recovery", () => {
  test("a failed submit shows the summary, takes focus, and lists errors in field order", async ({
    page,
  }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "About you" }).click();

    await page.getByRole("button", { name: "Save and continue" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();

    await expect(summary.getByRole("link")).toHaveText([
      "Enter your first name",
      "Enter your last name",
    ]);
  });

  test("a summary link moves focus into the field it names", async ({ page }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "About you" }).click();
    await page.getByRole("textbox", { name: "First name" }).fill("Ada");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await page.getByRole("link", { name: "Enter your last name" }).click();

    await expect(page.getByRole("textbox", { name: "Last name" })).toBeFocused();
  });

  test("errors clear as they are fixed, without a second submit", async ({ page }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "About you" }).click();
    await page.getByRole("button", { name: "Save and continue" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary.getByRole("link")).toHaveCount(2);

    await page.getByRole("textbox", { name: "First name" }).fill("Ada");
    await expect(summary.getByRole("link")).toHaveCount(1);
  });
});

test.describe("adding more than one of something", () => {
  test.beforeEach(async ({ page }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "Your children" }).click();
  });

  test("a branching answer inside the sub-flow opens the question it should", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");

    await expect(page.getByRole("heading", { name: "Does Ava live with you?" })).toBeVisible();

    await chooseRadio(page, "no");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page.getByRole("heading", { name: "Who does Ava live with?" })).toBeVisible();
  });

  test("a child who lives with you is never asked the living arrangement", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible();
    await expect(page.getByText("Ava Chen")).toBeVisible();
  });

  test("going back through the sub-flow keeps the answers", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");

    await page.goBack();
    await expect(page.getByRole("heading", { name: "What is Ava's date of birth?" })).toBeVisible();
    await expect(page.locator('input[name="day"]')).toHaveValue("12");

    await page.goBack();
    await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue("Ava");
    await expect(page.getByRole("textbox", { name: "Last name" })).toHaveValue("Chen");
  });

  test("a second child starts empty rather than holding the first one's answers", async ({
    page,
  }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await page.getByRole("button", { name: "Add another child" }).click();

    await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Last name" })).toHaveValue("");
  });

  test("a link to a child who has been removed lands on the list", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    const childId = await page.evaluate((key) => {
      const saved = window.localStorage.getItem(key);
      return JSON.parse(saved ?? "{}").children?.[0]?.id as string;
    }, STORAGE_KEY);

    await page.getByRole("button", { name: "Remove" }).click();

    // Wait for the removal to reach storage: the next line is a cold load, and saving
    // happens after the render.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const saved = window.localStorage.getItem(key);
          return JSON.parse(saved ?? "{}").children?.length ?? -1;
        }, STORAGE_KEY),
      )
      .toBe(0);

    await page.goto(`/your-children/${childId}/check`);
    await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a child" })).toBeVisible();
  });

  test("a half-added child blocks the section and says which one", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");

    // The record already exists: answers are saved page by page.
    await page.goto("/your-children");
    await expect(page.getByText("Not finished")).toBeVisible();

    await page.getByRole("button", { name: "Save and continue" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText(["Finish adding Ava Chen"]);
  });

  test("changing an answer from the check page comes back to the check page", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Check Ava Chen's details" })).toBeVisible();

    await page.getByRole("link", { name: "Change name" }).click();
    await page.getByRole("textbox", { name: "First name" }).fill("Avery");
    await page.getByRole("button", { name: "Save and return" }).click();

    await expect(page.getByRole("heading", { name: "Check Avery Chen's details" })).toBeVisible();
  });

  test("removing a child empties the list again", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await page.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText("Ava Chen")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a child" })).toBeVisible();
  });
});

/** Uploads commit on the action rather than on Continue, so the store is what to check. */
test.describe("uploading documents", () => {
  const aFile = (name: string) => ({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake"),
  });

  /** The dropzone's real input is presentation-hidden, so it is targeted directly. */
  const dropzone = (page: Page) => page.locator('input[type="file"]');

  test.beforeEach(async ({ page }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "Income and documents" }).click();
  });

  test("an uploaded file appears as a card and reaches the store", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Upload proof of your income" })).toBeVisible();

    await dropzone(page).setInputFiles(aFile("payslip.pdf"));

    await expect(page.getByText("payslip.pdf")).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const saved = window.localStorage.getItem(key);
          return JSON.parse(saved ?? "{}").documents?.proofOfIncome?.length ?? -1;
        }, STORAGE_KEY),
      )
      .toBe(1);
  });

  test("more than one file can be added, because income comes from more than one place", async ({
    page,
  }) => {
    await dropzone(page).setInputFiles(aFile("payslip.pdf"));
    await expect(page.getByText("payslip.pdf")).toBeVisible();

    await dropzone(page).setInputFiles(aFile("employer-letter.pdf"));

    await expect(page.getByText("employer-letter.pdf")).toBeVisible();
    await expect(page.locator("goa-file-upload-card")).toHaveCount(2);
  });

  test("removing takes the right file off the list", async ({ page }) => {
    await dropzone(page).setInputFiles(aFile("payslip.pdf"));
    await expect(page.getByText("payslip.pdf")).toBeVisible();
    await dropzone(page).setInputFiles(aFile("employer-letter.pdf"));
    await expect(page.getByText("employer-letter.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).first().click();

    await expect(page.getByText("payslip.pdf")).toHaveCount(0);
    await expect(page.getByText("employer-letter.pdf")).toBeVisible();
  });

  test("uploaded files survive a reload", async ({ page }) => {
    await dropzone(page).setInputFiles(aFile("payslip.pdf"));
    await expect(page.getByText("payslip.pdf")).toBeVisible();

    await page.reload();

    await expect(page.getByText("payslip.pdf")).toBeVisible();
  });

  test("continuing with nothing uploaded is refused and says so", async ({ page }) => {
    await page.getByRole("button", { name: "Save and continue" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText([
      "Upload at least one document showing your income",
    ]);
  });

  test("a file leads on to the other income question", async ({ page }) => {
    await dropzone(page).setInputFiles(aFile("payslip.pdf"));
    await expect(page.getByText("payslip.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Do you have any other income?" }),
    ).toBeVisible();
  });

  test.describe("the other income branch", () => {
    test.beforeEach(async ({ page }) => {
      await dropzone(page).setInputFiles(aFile("payslip.pdf"));
      await expect(page.getByText("payslip.pdf")).toBeVisible();
      await page.getByRole("button", { name: "Save and continue" }).click();
      await expect(
        page.getByRole("heading", { name: "Do you have any other income?" }),
      ).toBeVisible();
    });

    test("yes opens a page of its own, not a field under the radio", async ({ page }) => {
      await chooseRadio(page, "yes");
      await page.getByRole("button", { name: "Save and continue" }).click();

      await expect(page.getByRole("heading", { name: "What is your other income?" })).toBeVisible();
      await expect(page).toHaveURL(/other-income-detail/);
    });

    test("no ends the section on its check page, and checking it marks it done", async ({
      page,
    }) => {
      await chooseRadio(page, "no");
      await page.getByRole("button", { name: "Save and continue" }).click();

      await expect(page).toHaveURL(/\/documents\/check$/);
      await page.getByRole("button", { name: "Confirm and continue" }).click();

      await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();

      await expect(
        page.getByRole("link", { name: "Income and documents Completed" }),
      ).toBeVisible();
    });

    test("every answer given is still not done until the check page is passed", async ({
      page,
    }) => {
      await chooseRadio(page, "no");
      await page.getByRole("button", { name: "Save and continue" }).click();

      // The URL changes before React commits and before the effect that saves runs, so
      // wait for the page to render and the answer to reach storage before the cold load.
      await expect(page).toHaveURL(/\/documents\/check$/);
      await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();
      await expect
        .poll(async () =>
          page.evaluate((key) => {
            const saved = window.localStorage.getItem(key);
            return JSON.parse(saved ?? "{}").documents?.hasOtherIncome ?? null;
          }, STORAGE_KEY),
        )
        .toBe("no");

      await page.goto("/");
      await expect(
        page.getByRole("link", { name: "Income and documents In progress" }),
      ).toBeVisible();

      await page.goto("/review");
      await expect(page.getByRole("button", { name: "Agree and submit" })).toHaveCount(0);
    });

    test("the detail is required once it has been opened", async ({ page }) => {
      await chooseRadio(page, "yes");
      await page.getByRole("button", { name: "Save and continue" }).click();

      await page.getByRole("button", { name: "Save and continue" }).click();

      const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
      await expect(summary.getByRole("link")).toHaveText([
        "Tell us where your other income comes from",
      ]);
    });

    test("going back to no drops the detail rather than remembering it", async ({ page }) => {
      await chooseRadio(page, "yes");
      await page.getByRole("button", { name: "Save and continue" }).click();
      await page.getByRole("textbox", { name: "What is your other income?" }).fill("A weekend job");
      await page.getByRole("button", { name: "Save and continue" }).click();

      await page.goto("/documents/other-income");
      await chooseRadio(page, "no");
      await page.getByRole("button", { name: "Save and continue" }).click();

      await expect
        .poll(async () =>
          page.evaluate((key) => {
            const saved = window.localStorage.getItem(key);
            return JSON.parse(saved ?? "{}").documents?.otherIncomeDetail ?? null;
          }, STORAGE_KEY),
        )
        .toBeNull();
    });
  });
});

/**
 * A complete, checked application seeded straight into storage: what a person returning
 * to a finished draft arrives with. Typed as FormState so a new field fails to compile
 * here rather than four tests away.
 */
const COMPLETE_APPLICATION: FormState = {
  eligibility: { age: "yes", residency: "yes", otherSupport: "no" },
  aboutYou: {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-01-01",
    phone: "7801234567",
    street: "123 Main Street",
    city: "Edmonton",
    province: "Alberta",
    postalCode: "T5J 2N9",
  },
  children: [
    {
      id: "c1",
      firstName: "Kit",
      lastName: "Lovelace",
      dateOfBirth: "2015-06-02",
      livesWithYou: "yes",
    },
  ],
  documents: {
    proofOfIncome: [{ id: "d1", name: "payslip.pdf", size: 24576, type: "application/pdf" }],
    hasOtherIncome: "no",
  },
  submittedAt: null,
  confirmed: ["eligibility", "about-you", "your-children", "documents"],
  reference: null,
};

async function seed(page: Page, state: FormState) {
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: JSON.stringify(state) },
  );
  await page.reload();
}

test.describe("checking answers and submitting", () => {
  test("every page gets its own card and its own named Change link", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.getByRole("button", { name: "Check your answers" }).click();

    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();

    // Accessible names: on screen each reads "Change", and the target sits in a
    // visually hidden span.
    for (const [name, href] of [
      ["Change your name", "/about-you/name?from=review"],
      ["Change your date of birth", "/about-you/date-of-birth?from=review"],
      ["Change your contact details", "/about-you/contact?from=review"],
      ["Change your address", "/about-you/address?from=review"],
    ] as const) {
      await expect(page.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  test("a named card is a heading, so the sections have structure inside them", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");

    // By name and level rather than document order: getByRole returns light-DOM
    // headings before shadow-DOM ones, so the sequence is not the page's.
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About you", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What is your name?", level: 3 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How can we contact you?", level: 3 }),
    ).toBeVisible();
  });

  test("a locked section is not shown, and is not offered as a link", async ({ page }) => {
    await page.getByRole("button", { name: "Check your answers" }).click();

    await expect(page.getByRole("heading", { name: "Check if you can apply" })).toBeVisible();
    for (const locked of ["About you", "Your children", "Income and documents"]) {
      await expect(page.getByRole("heading", { name: locked })).toHaveCount(0);
      await expect(page.getByRole("link", { name: `Finish ${locked.toLowerCase()}` })).toHaveCount(0);
    }

    await expect(page.getByText("4 parts of your application are unfinished")).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish check if you can apply" })).toBeVisible();
  });

  test("a Change link lands on the page it names, and comes back with the change", async ({
    page,
  }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");

    await page.getByRole("link", { name: "Change your address" }).click();
    await expect(page.getByRole("heading", { name: "What is your address?" })).toBeVisible();

    await page.getByRole("textbox", { name: "Postal code" }).fill("T6G 2R3");
    await page.getByRole("button", { name: "Save and return" }).click();

    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();
    await expect(page.getByText("T6G 2R3")).toBeVisible();
  });

  test("an unfinished application is told what is missing, by name", async ({ page }) => {
    await seed(page, { ...COMPLETE_APPLICATION, children: [] });

    // The button is live even though the application is unfinished; the explanation
    // lives where it leads.
    await page.getByRole("button", { name: "Check your answers" }).click();

    await expect(page.getByText("You cannot submit this yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish your children" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agree and submit" })).toHaveCount(0);
  });

  test("a locked section cannot be opened by typing its URL", async ({ page }) => {
    for (const shut of ["/about-you/name", "/your-children", "/documents/proof-of-income"]) {
      await page.goto(shut);
      await expect(page).toHaveURL(/localhost:5173\/$/);
      await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
    }

    await page.goto("/eligibility/age");
    await expect(page.getByRole("heading", { name: "Are you 18 or older?" })).toBeVisible();
  });

  test("submitting gives a reference that survives a refresh", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");
    await page.getByRole("button", { name: "Agree and submit" }).click();

    // Any prefix: ABC is a fork's to replace, so the test asserts the shape.
    const reference = page.getByText(/Your reference number is [A-Z]+-/);
    await expect(reference).toBeVisible();
    const issued = (await reference.textContent())?.trim() ?? "";

    await page.reload();
    await expect(page.getByText(issued)).toBeVisible();
  });

  test("a submitted application cannot be edited, however you reach it", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");
    await page.getByRole("button", { name: "Agree and submit" }).click();
    await expect(page).toHaveURL(/\/confirmation$/);

    for (const route of ["/about-you/name", "/your-children", "/review", "/"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/confirmation$/);
    }
  });

  test("starting a new application reopens the service", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");
    await page.getByRole("button", { name: "Agree and submit" }).click();

    await page.getByRole("button", { name: "Start a new application" }).click();

    await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check if you can apply" })).toBeVisible();
  });
});
