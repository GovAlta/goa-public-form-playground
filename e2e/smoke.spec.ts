import { test, expect, type Page } from "@playwright/test";
import { SERVICE_NAME } from "../src/lib/service";
import { EMPTY_FORM, type FormState } from "../src/lib/form-state";

/**
 * WHAT UNIT TESTS CANNOT SEE.
 *
 * This suite is deliberately one file, and it is not trying to cover the service.
 * Every rule in src/lib is already unit tested, fast, with no browser. Duplicating
 * that here would be slower and would not find anything.
 *
 * What it covers is the bug classes this template actually shipped while its unit
 * tests were green, because each one lives in the wiring rather than in a part:
 *
 *  1. Walking the flow. Answers leaked between question pages: one route with a
 *     changing parameter reuses the component, so useState never re-initialised and
 *     each answer pre-filled the next question. Every rule was correct. Only walking
 *     the pages in order found it.
 *
 *  2. Surviving a refresh. The store is the one piece a person notices when it fails,
 *     and it fails on the return visit — the path nobody hand-tests.
 *
 *  3. Error recovery. Whether the summary appears, takes focus, and moves focus into
 *     the right field is behaviour no assertion about validation rules can reach.
 *
 *  4. Routes that close. Which pages a submitted application can still reach is a
 *     fact about the route table, not about any page — and the ways in that matter
 *     are the ones no button offers: a bookmark, a typed URL, the Back button. The
 *     same class covers where a Change link lands, which is a claim about two files
 *     agreeing that neither of them can check alone.
 *
 * These also happen to exercise the accessible names: getByRole('textbox', { name })
 * resolves through the control's ariaLabel, so a field that loses its name fails here.
 *
 * ---------------------------------------------------------------------------
 * FORKING THIS TEMPLATE: this suite is yours to delete.
 *
 * It exists to demonstrate rather than to constrain. If you delete it, delete
 * playwright.config.ts and the `test:e2e` script too. If you keep it, the classes
 * above are the ones worth keeping tests for as you add sections.
 * ---------------------------------------------------------------------------
 */

const STORAGE_KEY = "goa-public-form-draft";

/**
 * Choose a radio by clicking its label, which is what a person clicks.
 *
 * Worth knowing before writing tests against these components: the native input is
 * visually hidden behind the design system's own rendering, so a click on the input
 * never lands and a role-based locator resolves to something Playwright will refuse
 * to click. The label wraps the input, so clicking the words is both what a person
 * does and the thing that works.
 */
const chooseRadio = (page: Page, value: "yes" | "no") =>
  page.locator(`goa-radio-item[value="${value}"] label`).click();

/**
 * Walk a child as far as the branch, leaving the page on "Does <name> live with you?".
 *
 * The date picker needs driving rather than filling: the month is a dropdown, and its
 * day and year are number inputs carrying `aria-label=""`, so they cannot be reached
 * by accessible name at all. Targeting them by `name` is a workaround for a component
 * defect, not a preference — see the date-picker issues.
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
 * Answer the screener the way someone eligible would, and finish the task.
 *
 * The last press is the one that is easy to leave out. Answering the final question
 * ends on the screener's own check page, not on the task list, and the task is not
 * Completed until somebody passes through it. A version of this helper that stopped at
 * the last answer would leave every caller one page from where it thought it was, and
 * with the screener still reading "In progress".
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
  // Start every test from a genuinely empty application, not whatever the last one left.
  //
  // An empty draft is WRITTEN rather than the key removed, and the difference matters
  // now: nothing in storage means nobody has started, which is the app's cue to load
  // the sample application. Removing the key would begin every test part-answered.
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
    // Walked here rather than through passTheScreener, because the last two presses
    // ARE the claim: the final answer ends on the task's check page, and the press on
    // that page is what completes the task. A helper that hides them would leave this
    // test asserting the outcome of steps it never took.
    await page.getByRole("link", { name: "Check if you can apply" }).click();
    for (const answer of ["yes", "yes"] as const) {
      await chooseRadio(page, answer);
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await chooseRadio(page, "no");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/eligibility\/check$/);
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();

    // Answered but not yet checked, so the task is not done and the rest is still shut.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*In progress/ })).toBeVisible();

    await page.getByRole("link", { name: "Check if you can apply" }).click();
    await page.getByRole("button", { name: "Confirm and continue" }).click();

    await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "About you" })).toBeVisible();
  });

  test("an answer never pre-fills the next question", async ({ page }) => {
    // The specimen. Each question is its own page reached through one route with a
    // changing parameter, and a reused component instance carries the previous
    // answer forward. Nothing about it is visible to a unit test.
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

    // The not-eligible page is the screener's OTHER terminal, and it completes the
    // task the same way its check page does. Without that, the task list would hold
    // this section at "In progress" forever: the person has nothing left to answer,
    // and there is no page in the flow that could ever clear it.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();
  });
});

test.describe("coming back to a section", () => {
  /*
   * Where re-entering the screener lands, which is a fact about the route table and
   * the branch graph agreeing, and therefore invisible to any test of either alone.
   *
   * The version this replaces scanned the questions in the order they are declared
   * and sent people to the first one with no answer stored. Two questions have no
   * answer stored for reasons that are not "still to ask": one the branches never
   * reach, and every one after a gate that already failed.
   */
  test("a finished screener opens on its check page, not on a question nobody was asked", async ({
    page,
  }) => {
    // Said no to other support, so the follow-up asking which program is off the path
    // forever. It is unanswered because it was never asked.
    await seed(page, {
      ...COMPLETE_APPLICATION,
      eligibility: { age: "yes", residency: "yes", otherSupport: "no" },
    });
    await page.goto("/eligibility");

    await expect(page).toHaveURL(/\/eligibility\/check$/);
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();

    // The half this test was written for, and it outlives the destination changing:
    // whatever a finished section opens on, it must never be a question the person's
    // own answers ruled out.
    await expect(
      page.getByRole("heading", { name: "Which program is supporting you?" }),
    ).toBeHidden();
    await expect(page.getByText("Which program is supporting you?")).toHaveCount(0);
  });

  test("failing a gate does not lead on to the questions behind it", async ({ page }) => {
    await seed(page, { ...COMPLETE_APPLICATION, eligibility: { age: "no" } });
    await page.goto("/eligibility");

    await expect(page).toHaveURL(/\/eligibility\/check$/);

    // Only the question that was actually asked. The two behind the failed gate were
    // never reached, so showing either would be showing a question nobody answered.
    await expect(page.getByText("Are you 18 or older?")).toBeVisible();
    await expect(page.getByText("Do you live in Alberta?")).toHaveCount(0);
  });

  /*
   * A Change link on a task's own check page has to come back to that page.
   *
   * This is the claim the return target was rebuilt for. Both check pages render the
   * same summary components, so the only thing telling a Change link where to return
   * is the origin in the URL — and getting it wrong sends someone who started on their
   * task's check page to the whole-application review instead, a page they had not
   * asked for and may never have seen.
   */
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

  /*
   * And the same link on the whole-application review still returns THERE. The two
   * pages differ only by that origin, so this is the half that proves the parameter is
   * doing work rather than both paths happening to land in the same place.
   */
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

  /*
   * The demo reset. It is template furniture rather than service behaviour, and it is
   * tested for the same reason it exists: without it a saved draft makes the template
   * a one-shot, and the person who hits that is whoever is evaluating whether to use
   * it. Delete this test along with the control it covers.
   */
  test("the demo reset empties the application and says so on the task list", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Check if you can apply.*Completed/ })).toBeVisible();

    // Two elements answer to "Edna Mode" — the custom element and the real button
    // inside its shadow root both expose the role and the name — so the trigger needs
    // .first(). The items inside expose as buttons rather than menuitems.
    await page.getByRole("button", { name: "Edna Mode" }).first().click();
    await page.getByRole("button", { name: /^Demo: clear answers/ }).click();

    // The row's own accessible name carries its status, so this names one row and one
    // status rather than looking for the word anywhere on the page.
    await expect(
      page.getByRole("link", { name: /Check if you can apply.*Not started/ }),
    ).toBeVisible();

    // And it is gone from storage, not just from the screen. A reset that only clears
    // the view comes back on the next reload.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const saved = window.localStorage.getItem(key);
          return JSON.parse(saved ?? "{}").aboutYou?.firstName ?? null;
        }, STORAGE_KEY),
      )
      .toBeNull();
  });

  /*
   * The demo's own starting state. DELETE THIS TEST WITH THE SAMPLE APPLICATION.
   *
   * Every other test in this file writes an empty draft before it runs, so this is the
   * only one that exercises what happens when storage holds nothing at all — which is
   * exactly the path a first-time visitor takes, and the path the sample application
   * exists to serve.
   */
  test("a browser with nothing saved starts part-finished, and clearing is reversible", async ({
    page,
  }) => {
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    // One section in each state, which is the whole reason the sample is part-finished
    // rather than complete: the task list can only demonstrate its vocabulary if all
    // three are on screen together.
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

    // Genuinely empty: the screener is untouched and everything behind it is shut,
    // which is what a real first visit looks like.
    await expect(
      page.getByRole("link", { name: /Check if you can apply.*Not started/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^About you/ })).toHaveCount(0);

    // And the clearing did not persist, which is the only reason the next load can
    // fall back to the sample rather than to a saved empty draft.
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

    // The return visit: the whole application reloads from storage.
    await page.reload();
    await page.goto("/about-you/name");

    await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue("Ada");
    await expect(page.getByRole("textbox", { name: "Last name" })).toHaveValue("Lovelace");
  });

  test("a reload does not overwrite a saved draft with an empty one", async ({ page }) => {
    await passTheScreener(page);

    // Wait for the answer to actually be written before reloading, rather than
    // assuming it has been. Saving happens in an effect and the click resolves when
    // the click dispatches, so "click, then reload" is a race — and one this test
    // used to win by luck. What it is here to prove is what a reload does to a draft
    // that exists, so the draft has to exist first.
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toContain('"otherSupport":"no"');

    await page.reload();

    // The screener's answers survived, so the application is still open.
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

    // Top to bottom, matching the fields on the page. This is the whole reason the
    // rules are declared in field order.
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

    // The control lives inside the web component's shadow DOM, which is exactly why
    // the summary needs its own walker to reach it.
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

/**
 * The repeating group, which is the one part of this template the team asked for
 * specifically to find out whether it works at all.
 *
 * The worry on record was state across a sub-flow: "if there's no different pages the
 * url of the form will remain the same, so if you go back you lost the whole
 * children." Every test here is a version of that question.
 */
test.describe("adding more than one of something", () => {
  test.beforeEach(async ({ page }) => {
    await passTheScreener(page);
    await page.getByRole("link", { name: "Your children" }).click();
  });

  test("a branching answer inside the sub-flow opens the question it should", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");

    // The heading names the child, so the parent adding a third one knows whose
    // answer they are giving.
    await expect(page.getByRole("heading", { name: "Does Ava live with you?" })).toBeVisible();

    await chooseRadio(page, "no");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page.getByRole("heading", { name: "Who does Ava live with?" })).toBeVisible();
  });

  test("a child who lives with you is never asked the living arrangement", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");
    await chooseRadio(page, "yes");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Straight back to the list, where the new row is its own confirmation.
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

    // Wait for the removal to reach storage, not just the screen. The next line is a
    // cold load, which rebuilds the whole application from exactly that — and saving
    // happens after the render, so a test that navigates immediately races it and
    // gets a check page for the child it just removed.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const saved = window.localStorage.getItem(key);
          return JSON.parse(saved ?? "{}").children?.length ?? -1;
        }, STORAGE_KEY),
      )
      .toBe(0);

    // A bookmark, or a back button reaching past the removal. The page must not try
    // to render answers for somebody who is no longer in the application.
    await page.goto(`/your-children/${childId}/check`);
    await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a child" })).toBeVisible();
  });

  test("a half-added child blocks the section and says which one", async ({ page }) => {
    await addChildUpToTheBranch(page, "Ava", "Chen");

    // Leave without answering the last question. The record already exists, because
    // answers are saved page by page.
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

    // Each Change link names its own target, so this one is reachable by name rather
    // than by position — which is also the whole point of naming them.
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

/**
 * Uploading, which is the one place answers are committed on the action rather than
 * on Continue — so the thing worth testing is that the file reaches the store, and
 * is still there on the return visit.
 */
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

    // Removal is keyed by id, not position. Taking the first card off has to leave
    // the second one, not shift the wrong record out from under it.
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

  /** The second branch in the service, and the one that had a design call behind it. */
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

      // The row's accessible name carries its status, so this names one row and one
      // status. An earlier version of this assertion looked for "Completed" anywhere
      // inside an ancestor of the row and passed for a section that was not complete.
      await expect(
        page.getByRole("link", { name: "Income and documents Completed" }),
      ).toBeVisible();
    });

    test("every answer given is still not done until the check page is passed", async ({
      page,
    }) => {
      // The case the whole two-condition rule exists for, and the one that reads like
      // a bug to anyone assuming the answers decide. Nothing is left to answer here;
      // the task is still unfinished because nobody has looked at it.
      await chooseRadio(page, "no");
      await page.getByRole("button", { name: "Save and continue" }).click();

      /*
       * Wait for the page to actually RENDER, not just for the URL to change, and
       * then for the answer to reach storage.
       *
       * toHaveURL on its own is not enough and the way it fails is silent. The router
       * pushes the new URL synchronously, so the assertion passes before React has
       * committed and before the effect that saves has run — and the page.goto below
       * is a full load that takes the pending save with it. The answer never reaches
       * storage, the section is genuinely unfinished, and this test then reports
       * "In progress" no matter what the completeness rule says. It would pass with
       * the confirmation requirement deleted, which is the one thing it exists to
       * catch. Found by deleting it.
       */
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

      // Away without pressing Confirm, the way a person closes a tab.
      await page.goto("/");
      await expect(
        page.getByRole("link", { name: "Income and documents In progress" }),
      ).toBeVisible();

      // And the review page has to agree with the task list rather than offer a submit.
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

      // Back into the section and change the answer.
      await page.goto("/documents/other-income");
      await chooseRadio(page, "no");
      await page.getByRole("button", { name: "Save and continue" }).click();

      // The description is now an answer to a question nobody asked. It has to be
      // gone from the store, or it comes back the moment they flip to yes again.
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

/* -------------------------------------------------------------------------- */
/* 4. Routes that close                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A complete application, put straight into storage.
 *
 * Walking twenty pages to reach the review page would test the twenty pages, which
 * the tests above already do, and would make every assertion here depend on all of
 * them. Seeding is also a real path rather than a shortcut: it is exactly what a
 * person returning to a finished draft arrives with.
 */
/*
 * Complete means answered AND checked.
 *
 * Typed as FormState rather than left to inference, which is what makes this honest:
 * the day the state grows a field, this stops compiling instead of quietly seeding a
 * half-built application and failing four tests somewhere else with a message about a
 * missing button. `confirmed` was exactly that field.
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

    // The rule the review page is built on, asserted where it can actually break: one
    // card per page, each Change link named for what it changes and pointing at the
    // page that asks it. A shared link, or four links all called "Change", fails here.
    // Accessible names, not visible text. Every one of these reads "Change" on
    // screen; the target is in a visually hidden span so the column stays narrow
    // without the links becoming indistinguishable to anyone hearing them.
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

    // A card's name used to render as a styled <span>: identical on screen, invisible
    // to the outline. The page went h1, an h2 per section, then a run of cards with no
    // structure at all, so someone navigating by heading could reach "About you" and
    // then had to read every row to find the group they wanted. Only a check of the
    // roles could catch it, because a screenshot of the broken page and the fixed one
    // are the same picture.
    //
    // Asserted by name and level rather than by walking the page's headings in order:
    // getByRole pierces shadow DOM but returns light-DOM matches before shadow-DOM
    // ones, and every GoabText heading renders inside a shadow root, so the sequence
    // that comes back is not the page's sequence. Accessible names do resolve through
    // the slot, which is why this form works and an ordering assertion does not.
    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About you", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What is your name?", level: 3 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How can we contact you?", level: 3 }),
    ).toBeVisible();
  });

  test("a locked section is not shown, and is not offered as a link", async ({ page }) => {
    // Nothing answered, so the screener has not passed and the rest of the
    // application is shut. The task list greys those rows out; the review page has
    // to agree with it, rather than showing cards full of "Not answered" with a way
    // into each one.
    await page.getByRole("button", { name: "Check your answers" }).click();

    await expect(page.getByRole("heading", { name: "Check if you can apply" })).toBeVisible();
    for (const locked of ["About you", "Your children", "Income and documents"]) {
      await expect(page.getByRole("heading", { name: locked })).toHaveCount(0);
      await expect(page.getByRole("link", { name: `Finish ${locked.toLowerCase()}` })).toHaveCount(0);
    }

    // Still counted, though — it is a real reason the application cannot be sent.
    await expect(page.getByText("4 parts of your application are unfinished")).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish check if you can apply" })).toBeVisible();
  });

  test("a Change link lands on the page it names, and comes back with the change", async ({
    page,
  }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");

    await page.getByRole("link", { name: "Change your address" }).click();
    // Arriving somewhere that matches the link is the whole point of the card
    // boundary following the page boundary.
    await expect(page.getByRole("heading", { name: "What is your address?" })).toBeVisible();

    await page.getByRole("textbox", { name: "Postal code" }).fill("T6G 2R3");
    await page.getByRole("button", { name: "Save and return" }).click();

    await expect(page.getByRole("heading", { name: "Check your answers", level: 1 })).toBeVisible();
    await expect(page.getByText("T6G 2R3")).toBeVisible();
  });

  test("an unfinished application is told what is missing, by name", async ({ page }) => {
    await seed(page, { ...COMPLETE_APPLICATION, children: [] });

    // The button is live even though the application is not finished. That is the
    // point: the explanation lives where pressing it takes you.
    await page.getByRole("button", { name: "Check your answers" }).click();

    await expect(page.getByText("You cannot submit this yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish your children" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agree and submit" })).toHaveCount(0);
  });

  test("a locked section cannot be opened by typing its URL", async ({ page }) => {
    // Nothing has been answered, so the screener has not passed. The task list will
    // not link these and the review page will not list them — but neither of those
    // is a rule, they are just doors this application chose not to draw. The address
    // bar is a door too, and a bookmark from an earlier application is another.
    for (const shut of ["/about-you/name", "/your-children", "/documents/proof-of-income"]) {
      await page.goto(shut);
      await expect(page).toHaveURL(/localhost:5173\/$/);
      await expect(page.getByRole("heading", { name: SERVICE_NAME })).toBeVisible();
    }

    // The screener itself is never locked, or there would be no way to unlock anything.
    await page.goto("/eligibility/age");
    await expect(page.getByRole("heading", { name: "Are you 18 or older?" })).toBeVisible();
  });

  test("submitting gives a reference that survives a refresh", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");
    await page.getByRole("button", { name: "Agree and submit" }).click();

    // Any prefix, not this template's ABC. The prefix is a fork's program code and is
    // meant to be replaced, so pinning the literal would hand a forking team a failing
    // test for doing the right thing. A test in a template asserts the contract a fork
    // has to keep, not the values a fork will change.
    const reference = page.getByText(/Your reference number is [A-Z]+-/);
    await expect(reference).toBeVisible();
    const issued = (await reference.textContent())?.trim() ?? "";

    // The one thing the person was told to keep. Held in memory it would be gone the
    // moment they refreshed the page telling them to keep it.
    await page.reload();
    await expect(page.getByText(issued)).toBeVisible();
  });

  test("a submitted application cannot be edited, however you reach it", async ({ page }) => {
    await seed(page, COMPLETE_APPLICATION);
    await page.goto("/review");
    await page.getByRole("button", { name: "Agree and submit" }).click();
    await expect(page).toHaveURL(/\/confirmation$/);

    // A bookmark from before submitting, and the task list itself. Both are ways in
    // that no button on any page offers, which is exactly why the guard is a route
    // rather than a check on the pages that happen to have one.
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
