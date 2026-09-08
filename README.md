# Public form template

A complete, working government form you can fork and own. Built with the Government of Alberta Design System.

Somebody starts at a task list, answers an eligibility screener, works through three sections of questions, checks their answers, and submits. They get a reference number. If they close the tab partway through, their answers are still there when they come back. If they submit and then try to edit, the application is closed to them.

It is a real service in every way except three: nothing is ever sent anywhere, uploaded files are recorded by name and size but their contents are never kept, and there is no authentication behind the signed-in person in the header. Each of those is marked in the code where it matters.

## Use this template

Click **Use this template** at the top of this repository. That gives you a fresh repository with no shared history, which is the point: from that moment the code is yours. There is no update channel back into your copy, and nothing here will change under you.

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

```bash
npm run build        # type-checks, then builds
npm test             # unit tests
npm run test:e2e     # browser tests
```

## Where this template starts and stops

A real Alberta service is more than its form, and the pieces around the form belong to
different people. This template is the middle one, and knowing which piece you are
holding matters before you start adding pages to it.

```
  Guidance page on alberta.ca                        NOT this template
  What the service is, who can apply, what
  you need, and a "Start now" button
                 |
                 v
  Sign in                                            NOT this template
                 |
                 v
  My applications                                    NOT this template, not built yet
  Continue one, or start a new one. Only
  needed if somebody can have more than one
                 |
                 v
  +---------------------------------------+
  |  Task list                            |          THIS TEMPLATE
  |  Eligibility screener                 |
  |  Question sections, each one ending   |
  |    on its own check answers page      |
  |  Check your answers, for the whole    |
  |    application                        |
  |  Submit, and the confirmation         |
  +---------------------------------------+
```

**The guidance page is not yours to build here, but your service still needs one.** It
lives on alberta.ca, it is written and published like any other page there, and it ends
with the button that hands people to the application. Building your own version of it
inside the service is the common mistake: people arrive at your service from search, from
a letter, from a caseworker, and the page that explains the service has to be findable
where they are already looking.

**Sign in sits between that page and this one, and is a platform concern.** Nothing here
authenticates anybody. The signed-in person in the header is decoration, and the
application is kept in the browser rather than against an account, which is why anyone
with the link lands in the same draft.

**My applications is the piece most likely to be missing for you.** If somebody can only
ever have one application in flight, they can go straight from signing in to the task
list and there is nothing to choose between. The moment they can have two, they need a
list: which one to carry on with, or start another. That page is yours to build, it
belongs immediately before the task list, and this template does not include it.

What this template does cover is everything from the task list onward, which is the part
that is the same shape in every service and the part that is hardest to get right.

## The first things to change

Everything in this template is realistic on purpose, because that is what makes it worth reading. The questions branch the way real questions branch, the validation says what real validation says, the review page follows the rules a review page follows.

The exceptions are deliberate, and they are the parts that identify the service rather than the parts that teach. They ship as obvious placeholders so that nobody can deploy this by accident and have it look like a real government service:

| What | Where | Ships as |
| --- | --- | --- |
| The service name | `src/lib/service.ts` and the `<title>` in `index.html` | `[Service name]` |
| Contact details on the result pages | `src/components/results-page.tsx` | Bracketed placeholders |
| The declaration above the submit button | `src/routes/review/review-page.tsx` | A bracketed placeholder |
| The reference number prefix | `src/store/submission.ts` | `ABC` |

The rule underneath that split: the service's **identity** ships as a placeholder, its **substance** ships realistic. Weigh any stand-in by what it costs if somebody ships it unchanged. A plausible-looking service name is dangerous because there is nothing visibly wrong with it, so it survives into production. A bracket cannot.

The reference number itself is the opposite call, and it is worth understanding before you copy it. It is generated in the browser and looks real, because a confirmation page reading `[reference number]` leaves the page that most needs designing undesigned. In your service the reference comes back from your backend, because it has to identify a record that actually exists.

## The demo state, and removing it

**This demo does not start empty.** Open it in a fresh browser and you land on a
part-finished application: the eligibility screener passed, About you half answered,
one child added, nothing uploaded yet. That is deliberate. The half of a service that is
hardest to get right — the review page, the submit, the confirmation, the closed routes
— sits behind about twenty pages of typing, and nobody evaluating a template should have
to do that typing first. It is also the only way the task list can show what it is for,
because Completed, In progress and Not started only mean something side by side.

**Demo: clear answers (refresh restores)** in the header menu empties it, so the genuine
first-run state is one click away: an untouched screener with everything behind it shut.
Refreshing brings the sample back, because clearing leaves nothing saved and nothing
saved is this demo's cue to start again.

**Removing it is three deletions, and the compiler finds the rest for you:**

- `src/demo-application.ts`
- the import and the `?? DEMO_APPLICATION` fallback in `src/store/form-store.tsx`
- the `Demo:` item and its handler in `src/App.tsx`

Leave the rest of the store alone. Not saving a completely untouched form is worth
keeping: an untouched form is not a draft, and writing one over storage is the same
class of mistake as overwriting a returning person's answers with an empty page.

The answers themselves are obvious inventions, for the same reason the service name
ships as `[Service name]`. The one way this file can hurt anybody is a fork shipping it
by accident, and the defence against that is that it is impossible to miss: every person
who opens the service sees somebody else's application, immediately.

## How a task gets finished

Every task ends on its own check answers page, and that page is what completes the task.
Answering the last question in a section does not send you back to the task list. It
sends you to a page showing everything the section collected, with a Change link beside
each answer, and a button that finishes the task and takes you back. Clicking a finished
task on the list brings you to the same page, because that is simply where the task ends.

So there are two tiers of checking, doing two different jobs. A task's own check page is
the confirmation that one part is done, and a person meets one of those once per task.
`/review` is the check over the whole application, and it is where the application is
sent. Both are built from the same summary components, in `src/routes/review/summaries.tsx`,
told where a Change link should return to.

**This is why a task can be fully answered and still say In progress.** A task is
Completed when every required answer is present *and* the person has passed through its
check page. The second condition is only ever able to hold a task back, never to carry
one over the line on its own, which is what stops it drifting away from the answers: a
change that reopens a question makes the answers incomplete by itself, and the row goes
back to In progress with nothing anywhere having to un-confirm it.

**Not every task needs one.** A task that asks a single question would be showing a
person one answer they are still looking at. That is a decision per task rather than a
rule about how many questions it has, and it is the `hasCheckPage` switch in
`src/lib/sections.ts`. Turn it off and the last question returns straight to the task
list, and the task is Completed on its answers alone. All four tasks here have one.

## What is in here

```
src/
  lib/          The service, with no user interface attached. Question order,
                branch graphs, completeness rules, validation, formatting.
                Nothing in here imports React, the router, or the design
                system, and a test enforces that.
  components/   Shared pieces the pages are built from: the page layout, the
                form set, the summary trio, the error summary, the item list,
                and the shell every task's check answers page is built on.
  routes/       The pages, one folder per section, plus the task list, the
                review and confirmation pages, and the route guards. Each
                section owns its own check answers route.
  store/        State, and the two seams a real service replaces.
  demo-application.ts
                The answers this demo starts with. Delete it.
e2e/            Browser tests. Yours to delete.
scripts/        Checks that keep this README honest.
```

The split between `src/lib` and everything else is the one worth knowing about. `src/lib` holds what the service *is*, and it would be the same service in Angular or Vue. Everything above it is one way of rendering that. When a rule seems to live in a page, it is usually in the wrong place.

## The two seams

Two files stand between this template and a real service. Both are already `async`, so the signatures already fit and no other file's wiring has to move.

**What they do not do is fail.** Neither seam handles failure, because neither can fail as written, and that is the one thing a fork has to add rather than replace. Saving a draft swallows its error today; a real service has to surface it, because silently not saving is the failure people never forgive. Submitting has no `try`/`catch` at all, and the catch belongs in `src/routes/review/review-page.tsx` rather than in the seam, because what somebody sees when a submit fails is a design decision about your service, not an implementation detail of sending. Both places say so in their own comments.

**`src/store/persistence.ts`** holds part-finished applications. It saves to the browser's local storage, which is a stand-in so the template works with no backend, and it is not a recommendation. A part-finished benefits application is personal information about somebody, and often about their children. Local storage is readable by any script on the origin, survives sign-out, and stays on a shared computer after the person walks away. Where real draft answers live is a decision for your service and your privacy reviewers, and it is worth making deliberately rather than inheriting from a template.

**`src/store/submission.ts`** is the single moment the application leaves the browser. It returns a receipt: a timestamp and a reference number.

## Deploying

The workflow in `.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`, and once it succeeds your fork has a live public site. Turn the workflow off if that is not what you want yet.

**Pages has to be switched on once, by hand.** Go to Settings, then Pages, and set the build and deployment source to **GitHub Actions**. The workflow deliberately does not do this for you: `actions/configure-pages` only enables Pages when it is handed a personal access token, and a template has no business asking you to create one. After that single setting, every push to `main` deploys with nothing further to do.

You do not need to configure the path. The build reads the repository name and sets the base path from it, and the router reads the same value back, so routing and assets can never disagree. A fork under any name deploys correctly with no file edits.

One quirk worth knowing before it wastes an afternoon. GitHub Pages has no server-side rewrite, so deep links work by serving a copy of `index.html` as `404.html` and letting the router take over. **Pages sends an HTTP 404 status alongside that document by design.** The page is correct and renders correctly. Only the status code is misleading. Check deep links by what renders, never by status code, and expect uptime monitors to report a problem that is not there.

## Tests

Unit tests sit beside what they test in `src/lib` and `src/store`. They cover the service's rules and need no browser.

The browser suite in `e2e/smoke.spec.ts` is deliberately one file, and it does not try to cover the service. It covers the bug classes this template actually shipped while its unit tests were green, because each one lives in the wiring rather than in a part: answers leaking between question pages, a draft not surviving a refresh, an error summary that does not take focus, and which routes a submitted application can still reach.

**The browser suite is yours to delete.** If you delete it, delete `playwright.config.ts` and the `test:e2e` script too. If you keep it, the classes above are the ones worth writing tests for as you add sections.

One rule the tests here follow, which is worth keeping if you extend them: a test in a template asserts the contract a fork has to keep, not the values a fork will change. The reference number tests check the shape and the alphabet, never the `ABC` prefix, because you are expected to replace it and a failing test on day one for doing the right thing teaches people to delete tests.

## This template and the component library

The Government of Alberta component library does not allow custom CSS. This template does, and the difference is deliberate rather than an oversight.

A component library has to be the same everywhere it is used, so custom CSS in it is a defect. A service is a specific thing for a specific job, and it needs layout, rhythm and interaction states that no library ships. The task list rows here need `:hover` and `:focus-visible`, which a style attribute cannot express.

The rule that keeps it honest, in `src/index.css`: reach for GoA custom properties for values, and scope your CSS to your own class names. Never restyle a component's internals. `background-color: var(--goa-color-greyscale-100)` on your own row class is fine. Reaching inside a component to change how it draws itself is not, because the next version of that component will not know you did it.

## Keeping dependencies current

The `@abgov` packages are on ranges rather than exact pins, and the lockfile is committed. `npm update` gets the latest stable release within the current majors. A range will never resolve to a prerelease, so you cannot drift onto an unreleased version by accident.

Version numbers live in `package.json` and are deliberately not repeated in this file, because a version written into a README is a claim that goes stale silently. This one cannot be wrong about them, because it does not make the claim.

## How this README is kept honest

A template's README drifts before its code does. The usual failure is not that somebody writes something false, it is that the code moves and the README stays still, and nobody notices because nothing is checking.

`scripts/readme.test.ts` runs with `npm test` and fails the build when this file stops describing the repository:

- Every file and folder named here has to exist.
- Every folder directly under `src/` has to be mentioned here, so a new area cannot appear silently.
- The `<title>` in `index.html` has to match `SERVICE_NAME`, because it is the one copy of the service name that cannot read the constant.
- Every path named in a source comment has to exist too, so a moved file cannot leave stale directions behind it.

Know where that stops. These checks can tell whether the things this file names are real. They cannot tell whether a sentence about them is true, so a README describing the wrong behaviour in correct file names passes every one of them. That gap is not theoretical: the first draft of this file claimed that replacing the two seams "changes nothing else," which a source comment three files away flatly contradicted, and no assertion here noticed. It took somebody reading both.

So the checks are worth having and are not a substitute for reading. They cover the failure that happens silently and continuously; a person still has to cover the one that happens once, on purpose, and wrongly.

None of this can prevent your fork from drifting away from this template, and nothing should: the code is yours, and going your own way is what forking is for. What it prevents is this repository lying about itself.
