# Design notes

The reasoning behind decisions in the code, kept here so the code reads at the speed of
the app. Each entry names the file it explains; when a comment in the source says "see
docs/design-notes.md", this is where it points. Read top to bottom it is roughly the
shape of the service: the shell, how a task completes, the question pages, the review,
what the demo does that a real service will not, and the repository around it.

## Where this template starts and stops (`src/App.tsx`, `src/routes/task-list.tsx`)

A real Alberta service is more than its form, and the pieces around the form belong to
different people. This template is the middle one, and knowing which piece you are
holding matters before you start adding pages to it.

The guidance page is not yours to build here, but your service still needs one. It lives
on alberta.ca, it is written and published like any other page there, and it ends with
the button that hands people to the application. Building your own version of it inside
the service is the common mistake: people arrive from search, from a letter, from a
caseworker, and the page that explains the service has to be findable where they are
already looking.

Sign in sits between that page and this one, and is a platform concern. Nothing here
authenticates anybody. The signed-in person in the header is decoration, and the
application is kept in the browser rather than against an account, which is why anyone
with the link lands in the same draft.

My applications is the piece most likely to be missing for you. If somebody can only
ever have one application in flight, they go straight from signing in to the task list
and there is nothing to choose between. The moment they can have two, they need a list:
which one to carry on with, or start another. That page belongs immediately before the
task list, and this template does not include it.

What the template does cover is everything from the task list onward, which is the part
that is the same shape in every service and the part that is hardest to get right.

## The first viewport belongs to the question (`src/App.tsx`)

The layout pins the footer to the bottom of the viewport on a short page, so a
one-question page would arrive with site chrome sitting right beside the question.
Holding the content region to a full viewport pushes the footer past the fold: the person
sees the question and nothing else, and reaches the footer only by scrolling to the end,
which is where they are done rather than where they are working.

The header's height is subtracted because a content region of a whole viewport sits
below a header, so the page would be one viewport plus a header and the footer would
start a header's height past the fold, leaving a band of nothing to scroll into. The
height is observed rather than written down: a long service name doubles the header at
phone width, and GoabAppHeader grows when a service adds nav links.

`vh` rather than `dvh`. `dvh` tracks the viewport as mobile browser chrome shows and
hides, so it recalculates mid-scroll and reflows the page under someone's finger while
they are filling in a field. `vh` resolves to the largest viewport and never changes. It
slightly overshoots on mobile once the address bar is showing, which costs a little extra
scrolling; underfitting would let the footer peek, which is what the rule exists to
prevent.

## The demo reset, and why it is not on "Sign out" (`src/App.tsx`)

Answers save automatically and persist, which is right for somebody applying and wrong
for somebody evaluating: they open the demo, answer three questions, come back later and
land halfway through a form they do not remember starting. The "Demo: clear answers"
item exists so the demo is re-runnable.

It is deliberately not hung off "Sign out". Signing out of a real service keeps the
draft; that is the whole reason a draft is saved against an account rather than a
browser. Wiring sign-out to a wipe would teach the inverse of what it looks like it is
teaching, and a fork that later adds real authentication would inherit it without
noticing.

## A task is completed by its check page, not by its last answer (`src/lib/sections.ts`, `src/lib/form-state.ts`, `src/components/task-review.tsx`)

There are two tiers of checking with two different jobs. A task's own check-answers page
is the confirmation that one part is done, and a person meets one of those once per task.
`/review` is the check over the whole application, and it is where the application is
sent.

A task is Completed on the task list when every required answer is present *and* the
person has passed through its check page. The second condition is necessary and never
sufficient, and that is what keeps `FormState.confirmed` from becoming a second source of
truth that drifts from the answers: nothing ever removes an id from that list, because a
change that reopens a question (saying yes to other income opens a question about it)
makes the answers incomplete on their own, and the row drops back to In progress with no
un-confirming logic anywhere. Correcting a typo from the final review does not punish
the person by reverting a task they already checked.

The check page is one shell rather than four pages because the only things that differ
are which task it finishes and which summary it shows. A person meets this page four
times, and meeting a slightly different version each time is how a form starts feeling
improvised.

Not every task needs one. A task that asks a single question would be showing a person
the one answer they are still looking at. That is a per-task decision, `hasCheckPage`,
rather than a rule derived from how many questions there are, because only whoever
designed the task knows.

## "Confirm and continue" (`src/components/task-review.tsx`)

A button is a contract: say what pressing it does. Nothing is saved on a task's check
page, the answers were saved page by page on the way in. What happens is the person
saying they have looked, and reusing the question pages' "Save and continue" would make
the one press that changes the task's status read as the most ordinary press in the form.

## Guards are routes, not checks (`src/routes/guards.tsx`, `src/index.tsx`)

Both rules live in route wrappers rather than inside the pages they govern. A page
added later is covered by where it is registered instead of by whoever adds it
remembering to guard it, and `src/index.tsx` shows the whole rule at a glance.

A task list that greys a row out, or a button that stops being offered, controls only
the doors the application draws. The address bar is a door too, and so is the Back
button, and so is a bookmark someone made yesterday. A rule enforced only where the
UI happens to offer a link is not enforced. Until the unlock guard existed, someone who
bookmarked "About you" during an earlier application could fill in a section the
service had decided was shut. It sends people to the task list rather than the
screener, because the task list already says "Check if you can apply before you start
these", which is the reason they were moved.

## Why the return origin is a name in the URL (`src/lib/return-to.ts`)

A Change link on a check-answers page drops a person into the middle of a section, and
Back and Continue then have to return them to the page they came from rather than
resuming the walk. The obvious encoding is `?from=/review`, carrying the destination
and navigating to it. A page that navigates to whatever the URL tells it to is an open
redirect, and a template is copied, so the idiom would arrive one day in a service where
the target is not a route in the same app. A closed set of names cannot do that, and it
cannot break when a route is renamed, because each section resolves the name against
its own paths.

The origin is carried in the URL rather than router state because router state does
not survive a refresh; someone who reloads mid-change would be silently dropped back
into a normal run and sent onward instead of back to the page they were checking.

`readReturnTo` is generic over the list a section supports, so `readReturnTo(params,
["review", "task"])` is typed as `"review" | "task" | null` rather than the whole
union. That makes each section's map of origins to paths provably exhaustive: declaring
an origin the section has no path for stops compiling, instead of navigating to
undefined at runtime in the one flow nobody re-tests.

## Where the page breaks fall (`src/sections/about-you/rules.ts`)

Nothing forces a split in a section that does not branch, so each page break has to earn
itself. Two questions share a page only when you have to hold both in your head to answer
either. You say a first and last name in one breath and you recall an address whole, so
those group. You do not need your name in mind to remember your birthday, so that is its
own page.

Splitting is not a cost to minimise: answering one thing and moving on is easier than
holding four, and a shorter page is a shorter validation cycle, so a failed submit sends
you back over less ground.

The screener next door (`src/sections/eligibility/rules.ts`) is a graph because it branches and
three separate things need to ask the flow questions about itself. About you is an
ordered array because nothing in it branches. Building it as a graph too would work, and
would teach anyone forking this that a section needs one. It does not; the mechanism
should follow the shape of the questions.

## Hand-written pages, not a renderer (`src/sections/about-you/pages.tsx`)

About you is four hand-written pages rather than one page driven from config, the
opposite of the screener next door. The screener's questions are all the same shape, a
yes/no or a text box, so one component renders all of them from data. These four are
genuinely different controls, and a registry that could render all of them would be
more machinery than the four pages it replaced, in the file a person forking this is
most likely to edit. It also buys something for free: four distinct components on four
explicit routes cannot have the remount bug the screener needed a `key` for, because
React unmounts one and mounts the other.

The email field is the only optional answer in the service, so it is the only field
carrying the marker. Marking the optional ones rather than the required ones matches
what people already assume, that everything is required unless told otherwise.

Province and postal code stack rather than sit side by side. A form is filled fastest
down a single column, and the error summary jumps through fields in order; "top to
bottom" stops meaning anything the moment two fields share a row. Each is sized to
what it holds rather than run full width, so the width itself hints at the answer.

The province dropdown carries no `autoComplete`, and its absence is measured rather
than an oversight. GoabDropdown accepts the prop and does nothing with it: it renders
a custom combobox rather than a native select and hardcodes `autocomplete="off"` on
the input inside its shadow root. Passing "address-level1" changes nothing, so it is
not passed; a template is read as an example, and a prop that looks load-bearing and
is inert teaches every fork to write more of them. The consequence is that this one
field cannot join the address autofill the four around it support.

The date of birth uses `type="input"`, a month dropdown with day and year text boxes,
which is the right shape for a date a person already knows; the calendar variant is
for dates someone is picking rather than recalling, and reaching a birth date through
it means clicking back through several hundred months. There is deliberately no `max`
to block future dates: clamping the control would hide the mistake rather than
prevent it, and the person would be left wondering why the year would not take. The
validation rule says so in words instead. GoabDatePicker exposes no `ariaLabel` and
names its inner fields "month", "" and "", so the h1 is the only place the question
is stated to a screen reader user, and it is not attached to the field. That is a
component gap, not something a page can close.

## A follow-up question is its own page, not a reveal (`src/sections/documents/rules.ts`)

Income and documents asks whether there is other income and, only if there is, what it
is. The follow-up is its own page rather than a field revealed under the "yes". A field
appearing the instant a radio is chosen reads as a lever, pick this and get that, which
nudges the answer, and on a page asking about income that nudge points in a direction
nobody should be pointing it. The screener treats the identical shape the same way,
asking "are you receiving support from another program?" and "which program is
supporting you?" on two pages.

## Why a repeating group is pages, not a modal (`src/sections/your-children/rules.ts`)

A child is four questions, and one of the answers changes what is asked next: a child
who does not live with you is asked who they do live with, and a child who does is not.
The rule the form follows everywhere is that an answer which changes the next question
forces a page break, and it does not stop applying because the questions are inside a
loop. So the sub-flow is built from the same pieces as the rest of the form, and a
person walking it barely notices they left the list.

The rule of thumb for anyone collecting something else: one field per item belongs
inline on the page itself, a handful of fields with no branching belongs in a modal,
more fields than that in a drawer, and an item with enough to it, or with a branch in
it, gets its own pages.

Structurally the sub-flow is the screener scoped to one item: a graph of steps, walkers
over it, and a prune for answers the current path no longer reaches. That repetition is
the point. A repeating group is the form pattern looped, not a different kind of thing,
and it ends on its own small check page for the same reason the form as a whole ends on
a review.

## A repeating group saves page by page (`src/sections/your-children/pages.tsx`)

Adding a child walks the same kind of question pages as the rest of the form, branching
on whether the child lives with the applicant, and returns to the list. The sub-flow is
the form pattern looped rather than a different mode with its own rules.

Answers save page by page, as everywhere else. The visible consequence: a child added
and abandoned halfway is a real row in the list, shown as unfinished, with Remove on it,
and the list will not let the section complete while one exists. The alternative,
holding the whole child in memory until a final confirm, would mean a browser refresh
mid-add silently discarding everything, which is not a promise a service can make while
its task list says progress is saved automatically.

The list is this task's check page. A check page shows every answer with a way to change
each one and a Continue that finishes the task, and the list already is that: a row per
child, Change and Remove on each, and a rule that will not let the section finish while
one is half added. A second page after it would show the same rows again.

The row never quotes free text. An earlier version read "Lives with " plus the person's
own words, which produced "Lives with Their grandmother": free text dropped
mid-sentence carries whatever casing it was typed with. Free text belongs in a field of
its own, on the check page, not composed into a sentence someone else wrote half of.

The child's check page groups cards by page rather than by field, so a person changing
a first name lands on the page that asks for the name with the last name beside it. Only
the pages actually walked are shown: a child who lives with the applicant was never
asked who else they live with, and listing that as unanswered would invent a gap.

The `key` on the per-child page is insurance. React Router reuses one component
instance when only a route parameter changes, which is how each screener answer once
pre-filled the next question. That cannot happen in this section today, because every
route between two children passes through the list, which unmounts the page. It stays
because the day someone adds a "next child" link, the bug would arrive silently and look
like a data problem rather than a routing one.

The children's name fields carry `autoComplete="off"` rather than a name token. WCAG
1.3.5 is about fields collecting information about the user; a child is a different
person, and a name token would invite the browser to fill the applicant's own name into
their child's. A browser told nothing guesses, so it has to be told to stop.

## Uploads commit on the action (`src/sections/documents/pages.tsx`)

Proof of income is the one page where answers are committed the moment they are given
rather than on Continue. Typing is an edit in progress: a half-typed postal code someone
abandons should not be saved. Uploading is a completed action with its own visible
result, the card appears, and in a real service the bytes have already left the browser.
Discarding it on Back would throw away something the person watched succeed.

Uploaded files sit below the drop area, not above it. The drop area is the control and
the cards are its result, so the result belongs after the thing that produced it.
Putting the cards first pushes the drop area further down the page with every file
added, and on a page with several documents it eventually moves off the screen.

The dropzone states its size limit itself, so the help text does not repeat it; help
text earns its place by adding what the control does not say, here the file types.

The "where does the other income come from" page is a text area rather than a
single-line input, because the honest answer is often more than one thing, a weekend
job and a room rented out. Sizing a field to the shortest plausible answer tells people
to give the shortest plausible answer.

`ACCEPTS_MULTIPLE_FILES` is true because income comes from more than one place. Set
false, a second upload replaces the first; `addDocument` in `src/sections/documents/rules.ts`
holds that behaviour, and the design system's upload control has no opinion on it.

## One file or many (`src/sections/documents/rules.ts`)

The design system's upload control has no notion of one file versus many: it takes no
`multiple` and no maximum, raises one event per file, and the service owns the list.
Every service has to decide this, nothing reminds it to, and the decision only shows up
when somebody uploads a second file. The rule here: where a page takes one document, a
second upload replaces the first, because someone who can already see their file and
uploads again is correcting it, not adding to it. Where a page takes several, uploads
accumulate, because each is a separate answer.

## The screener's two terminals (`src/sections/eligibility/pages.tsx`)

Being told you cannot apply is a finished screener: there is nothing left to answer,
and the task list would otherwise hold the task at "In progress" forever with no page
in the flow that could ever clear it. So the ineligible outcome records the
confirmation exactly as the check page does.

The error on a question page is set twice, and it is not a mistake. The form item
takes the message, as a string; the control takes a boolean that turns it red.
Setting only the form item gives you the words with no red field, which reads as a
page-level complaint rather than a field-level one.

Entering the section sends a person to the first question still unanswered on their
own path, or to the check page when the screener needs nothing. Walking the branches
is what stops someone being asked a question their answers ruled out; landing a
finished screener on its check page is what stops it dumping them into its last
question with no idea how they got there. The walk lives in `src/sections/eligibility/rules.ts`
with the other walkers: a page is the wrong place to keep a fact about the shape of
the service, which is exactly how the version this replaced came to scan the questions
in declaration order and ignore the branch graph sitting one import away.

## Pruning answers the path no longer reaches (`src/sections/eligibility/rules.ts`, `src/sections/your-children/rules.ts`, `src/sections/documents/rules.ts`)

Someone says they receive support from another program, names it, then goes back and
says no. The named program is now an answer to a question nobody asked: left in place
it shows up on the review page, and it comes back if they flip the answer again, which
reads as the service remembering something they took back. So each branching section
prunes what its current path no longer reaches. The two sub-flows only prune once the
path is fully walked: a half-answered section says nothing about what lies beyond the
question it stopped at, and pruning on that basis would delete work already done.

## Nothing unreachable in a template (`src/sections/about-you/rules.ts`, `src/sections/documents/rules.ts`, `src/sections/your-children/rules.ts`)

A template is read as an example, so a branch that can never execute teaches every fork
to write more of them. Three places deliberately have less validation or less code than
they look like they should:

- About you has no "that is not a real date" rule. The date control reports missing,
  partly filled and impossible dates as the same empty value, so a page cannot tell
  them apart; someone who fills in the day and the year and forgets the month is told
  "Enter your date of birth" while looking at two thirds of one. Granular date errors
  become possible when the picker exposes partial input; until then the aspiration
  belongs on the component issue, not in a rule here that cannot run.
- The proof-of-income page has one rule. Size and file type are enforced by the upload
  control, which refuses the file before the page ever hears about it.
- Your children has no field-to-page lookup, although About you does. About you's
  review lists every answer, so a Change beside a postal code has to find the page that
  asks for it. A repeating group collapses on review to each item's name with one
  Change back to the list, because a review listing eight fields per child for four
  children is unreadable and the person only needs to confirm the right people are
  listed. Nothing ever asks which page a child's field lives on, so a lookup would be
  correct, tested, and never called.

## Dates are text (`src/lib/format.ts`, `src/lib/validation.ts`)

A date of birth has no time and no timezone, so it is stored and compared as
`yyyy-mm-dd` text. Formatting splits the string by hand rather than passing it to `new
Date(iso)`: `new Date("1990-01-01")` is parsed as midnight UTC, which in Alberta is the
evening of 31 December 1989, so formatting it in local time shows the wrong day for
everyone west of Greenwich. The not-in-the-future rule compares text too, which sorts
correctly and keeps it free of timezone arithmetic, and "today" is the person's local
day. The rule lives with the generic validation rather than beside one section's
questions because two sections ask for a birth date, and a rule copied into a second
place eventually means two different things.

## Validate on submit, never as someone types (`src/components/use-form-validation.ts`)

Telling a person their email is invalid while they are still typing it is telling them
they are wrong before they have finished being right. After a failed submit the rules do
run on every change, so errors clear as they are fixed.

## Autocomplete tokens (`src/sections/about-you/pages.tsx`)

Every field about the applicant carries an `autoComplete` token. WCAG 2.2 AA 1.3.5
Identify Input Purpose asks that a field collecting information about the person be
programmatically identifiable; it is also the difference between a browser filling an
address in one gesture and a person typing it again.

Left off, browsers guess from labels and names, and they guess badly. Chrome reads these
name fields as payment fields, which is visible over plain HTTP as a warning about payment
autofill on an insecure connection, and invisible over HTTPS while still being wrong.

## A field's accessible name comes from the control, not the visible label (`src/components/form-set.tsx`)

The visible label and the name assistive technology announces are two separate strings.
A control that carries its own `ariaLabel` is announced by that, whatever the label beside
it says, so the two can drift apart silently. Keep them the same words, and when a lone
question has no visible label, the control's `ariaLabel` is doing all of the work.

A lone question's heading has to be a real heading. Letting a large field label stand in
for it renders a `<label>` styled to look like an `<h1>`, and pages built that way shipped
with no heading at all: presentation standing in for structure, invisible on screen, gone
for anyone navigating by heading. That is why `heading` is required on `FormSet`.

## One card per page (`src/sections/*/summary.tsx`)

The summaries are written once and rendered on two pages: the whole application's
review shows all four, and each task's own check page shows one. A second copy of
"how About you reads back" is a second copy that drifts.

One card per question page, not one card per section. A Change link has to land
somewhere that looks like what the person clicked: someone changing their postal code
and arriving on a page headed "What is your name?" thinks they clicked the wrong link,
and someone changing a name and landing on a page of five fields has to hunt for the
one they meant. So About you is four cards because it is four pages, and each card's
heading is that page's own heading. Every Change link is built from the same step
definitions the question pages are built from, so a page that gets renamed, split or
reordered takes its Change link with it. Only the row labels and the way each answer
reads are written out, because those are the content of the page rather than a fact
about the flow.

A heading only where the card holds more than one answer. A page asking one thing would
otherwise say it twice: the card headed "What is your date of birth?" over a row
labelled "Date of birth". The second label is not a smaller heading, it is the same
question again. Income and documents is the case where no card earns a heading.

Every Change link reads "Change" on screen. Spelling the target out visibly made a
ragged column of long links that also ate the width the answers needed. But "Change,
Change, Change" is useless to anyone meeting the links on their own, tabbing through
or listing them, and a review page is exactly where people move between links rather
than read top to bottom. So the target rides in the accessible name, as destinations
("your age") rather than the page headings, because a heading is a question.

"Not answered" exists so a half-finished application still shows its own shape; a
review page that silently omitted the rows a person had not reached yet would look
like their answers had gone missing, the one thing a form promising "your progress is
saved" must never look like. It deliberately reads the same as a skipped optional
question: the two mean different things to whoever wrote the form and exactly the same
thing to the person reading it.

The repeating group collapses to each child's name and one Change back to the list.
Four children at five answers each is thirty rows to read past, and what the person is
confirming is that the right people are listed. The Change link carries no return
target: the list is where children are managed, and it returns to the task list
itself. Sending someone back to review from a page where they might add three more
children would be answering a question they had not finished asking.

Where these could live instead: each summary arguably belongs in its own section
folder, beside the questions it shows back, which is the decomposition a fork adding a
fifth section would find easiest to copy. They are together because the one-card-per-
page rule is only visible when the four are side by side.

## What a Change link says, on screen and out loud (`src/components/form-summary.tsx`)

On screen every Change link says "Change", because a column reading "Change where your
other income comes from" is long, ragged, and squeezes the answers beside it. Listed by a
screen reader, though, "Change, Change, Change" names nothing, and a review page is
exactly where someone moves between links rather than reading top to bottom. So the
target goes in the accessible name and out of the layout. That is the only reason to hide
text: never to hide something from anyone, only to let the visual and spoken forms of the
same thing differ.

The card headings are real `<h3>` elements drawn as the quiet grey label they replaced. A
styled span looked identical and put nothing in the page outline, so someone navigating
by heading could reach a section and then had to read every row to find the group they
wanted. h3 is the level under the section's h2; skipping to h4 for smaller type would make
the outline lie, so the type is moved with `font: inherit` instead.

## The review page (`src/routes/review-page.tsx`, `src/routes/task-list.tsx`)

The "Check your answers" button on the task list is live whether or not the
application is complete, and it was changed from disabled deliberately. A greyed-out
button tells nobody why it is greyed out. It cannot be focused, so a person moving
through the page by keyboard or screen reader meets nothing at all where the main
action should be, and to everyone else it reads as broken rather than blocked. The
explanation lives on the page they reach by pressing it: what is unfinished, by name,
each one a link. A locked section is still listed as a reason the application cannot
be sent, but not linked, because a link to a page the person is not allowed to open
yet is an invitation to try.

A locked section is not shown as a card at all. Showing cards full of "Not answered",
each with a Change link into a section the person is not allowed to open, contradicts
the task list and offers a way in the service does not intend.

There is no "I agree" checkbox above the submit button. A separate checkbox asks a
second question to get the same answer the button already gets, and there is no
evidence ticking it carries more weight than pressing a button that says what
pressing it means. Adam Silver, on the child funeral fund service: "it's not clear
that clicking a checkbox carries more legal weight than just pressing a button"; they
replaced "Submit claim" with "Agree and submit claim".

Submit is guarded against a second click, the one place in the form where a control
is closed off, and only for the duration of the action rather than as a standing
state. There is no try/catch around it, and that is a gap a fork has to close rather
than a decision: this implementation cannot fail, and what a person sees when a real
submit fails is a design question for the service, raised at the seam in
`src/store/submission.ts`.

## The confirmation (`src/routes/confirmation-page.tsx`)

The reference number is the reason the page exists; everything else is reassurance.
It leads, inside the status callout, rather than sitting in a paragraph the person has
to find. It survives a refresh because it is saved with the rest of the application
rather than held in memory by the page: someone told to keep a number will refresh,
bookmark, or come back to it, and a confirmation that evaporates on reload is a
service losing the receipt it just handed over.

The "Start a new application" button is demo furniture. A real service ends here,
usually with a link back to Alberta.ca; the button exists because a template that can
only be completed once is a template nobody can demonstrate twice.

## The two seams, and why neither fails (`src/store/persistence.ts`, `src/store/submission.ts`)

Two files stand between this template and a real service. Both are already async, so a
backend fits the signatures and no other file's wiring has to move.

Neither handles failure, because neither can fail as written, and that is the one thing
a fork has to add rather than replace. Saving a draft swallows its error today; a real
service has to surface it, because silently not saving is the failure people never
forgive. Submitting has no try/catch at all, and the catch belongs in the review page
rather than in the seam, because what somebody sees when a submit fails is a design
decision about the service, not an implementation detail of sending.

Persistence saves to the browser's local storage, which is a stand-in so the template
works with no backend, and it is not a recommendation. A part-finished benefits
application is personal information about somebody, and often about their children.
Local storage is readable by any script on the origin, survives sign-out, and stays on a
shared computer after the person walks away. Where real draft answers live is a decision
for the service and its privacy reviewers, worth making deliberately rather than
inheriting from a template.

Submitting is the one write that cannot wait for the next render. Every other save runs
in an effect after the state changes, and a page unloaded in that moment loses at most
one page of answers. A submitted application unloaded in that moment loses its
reference and reopens as a draft, so `recordSubmission` in `src/store/form-store.tsx`
saves the submitted state first and updates the state only once the save has returned.
The review page waits for it before navigating; with a real backend that wait is the
request.


## Why the demo starts part-finished (`src/demo-application.ts`)

The half of this service that is hardest to get right (the review page, the submit, the
confirmation, the lock) sits behind about twenty pages of typing, and nobody evaluating
it should have to do that typing first. So the demo starts with a sample application
loaded, and clearing it is one menu item away.

It starts part-finished rather than complete because the task list's job is to say what
is done, what is underway and what has not been touched, and it can only show that with
all three on screen at once: the screener passed (Completed), About you half answered (In
progress), one child fully added (Completed), nothing uploaded (Not started). It is also
close to the end, so anyone can finish it in a couple of minutes and reach the review
page and the confirmation.

The answers are obvious inventions, for the same reason the service name ships as
`[Service name]`: the one way this file hurts anybody is a fork shipping it by accident,
and the defence is that it is impossible to miss.

Removing the demo is three deletions, and the store's save guard is not one of them. An
untouched form is not a draft, and writing one over storage is the same class of mistake
as overwriting a returning person's answers with an empty page. Clearing the answers also
leaves nothing saved, which is what lets the sample come back on the next load.

## The reference number is generated in the browser, and the contact details are placeholders (`src/store/submission.ts`, `src/components/results-page.tsx`)

In a real service the reference comes back from the backend: it identifies a record that
now exists somewhere durable, which is what makes it worth quoting on the phone. A
reference generated in the browser refers to nothing, and two people could be handed the
same one.

It is generated here anyway because a confirmation page with no reference on it
demonstrates nothing. A service's whole promise at that moment is "here is your proof",
and a bracketed placeholder would leave the one page that most needs designing
undesigned.

That is the opposite trade from the contact details on the result pages, which are
bracketed placeholders. The difference is who gets hurt: a real-looking email address
shipped in a fork sends that fork's users to somebody else's inbox, while a stand-in
reference misroutes nobody. Weigh a placeholder by its blast radius, not by a rule about
placeholders. The reference's alphabet drops O/0, I/1/L, S/5, B/8 and Z/2 because it has
to survive a trip from screen to phone call to keyboard, and it is grouped in threes for
the same reason.

## Identity ships as a placeholder, substance ships realistic (`src/lib/service.ts`)

Everything in the template is realistic on purpose, because that is what makes it
worth reading: the questions, the branches, the validation, the review page. The parts
that identify the service, the name, the contact details, the reference prefix, ship as
obvious placeholders instead. A name does not teach, and a plausible one carries a real
risk: a fork deployed with "Apply for financial support" under the Alberta header is a
realistic-looking Government of Alberta service that is not one. Weigh each stand-in by
what it costs if somebody ships it unchanged; a bracket cannot survive into production.

The service name lives in the framework-neutral core rather than beside the header
that renders it so the browser tests can import it without loading React. That leaves
exactly one unavoidable copy, in `index.html`'s `<title>`, which renders before any
JavaScript and cannot read the constant; `scripts/readme.test.ts` asserts the two are
equal.

## Custom CSS in a service, and none in the library (`src/index.css`)

The Government of Alberta component library does not allow custom CSS, and this template
does; the difference is deliberate. A component library has to be the same everywhere it
is used, so custom CSS in it is a defect. A service is a specific thing for a specific
job, and it needs layout, rhythm and interaction states that no library ships: the task
list rows need hover and focus-visible states, which a style attribute cannot express.

The rule that keeps it honest: reach for GoA custom properties for values, and scope the
CSS to your own class names. A greyscale background token on your own row class is fine.
Reaching inside a component to change how it draws itself is not, because the next
version of that component will not know you did it.

## Deep links on GitHub Pages return 404 on purpose (`.github/workflows/deploy.yml`, `vite.config.ts`)

GitHub Pages has no server-side rewrite, so deep links work by serving a copy of
index.html as 404.html and letting the router take over. Pages sends an HTTP 404 status
alongside that document by design. The page is correct and renders correctly; only the
status code is misleading. Check deep links by what renders, never by status code, and
expect uptime monitors to report a problem that is not there.

The path needs no configuring. The build reads the repository name and sets the base
path from it, and the router reads the same value back, so routing and assets can never
disagree and a fork under any name deploys with no file edits. Pages itself has to be
switched on once by hand, because the configure-pages action only enables it when handed
a personal access token, and a template has no business asking anyone to create one.

## The tests assert the contract, not the values (`e2e/smoke.spec.ts`, `src/store/submission.test.ts`)

The browser suite is deliberately one file, and it does not try to cover the service. It
covers the bug classes this template actually shipped while its unit tests were green,
because each one lives in the wiring rather than in a part: answers leaking between
question pages, a draft not surviving a refresh, an error summary that does not take
focus, and which routes a submitted application can still reach. Those are the classes
worth writing tests for as sections are added.

A test in a template asserts the contract a fork has to keep, not the values a fork will
change. The reference number tests check the shape and the alphabet, never the prefix,
because a fork is expected to replace it, and a failing test on day one for doing the
right thing teaches people to delete tests.

## What the README check catches, and what it cannot (`scripts/readme.test.ts`)

A template's README drifts before its code does. The usual failure is not that somebody
writes something false; the code moves and the README stays still, and nobody notices
because nothing is checking. The repository this template is modelled on shows the end
state: its README documents files that were renamed away long ago.

The checks can tell whether the things the README names are real. They cannot tell
whether a sentence about them is true, so a README describing the wrong behaviour in
correct file names passes every one of them. That gap is not theoretical: the first
draft claimed that replacing the two seams "changes nothing else", which a source comment
three files away contradicted, and no assertion noticed. It took somebody reading both.
The checks cover the failure that happens silently and continuously; a person still has
to cover the one that happens once, on purpose, and wrongly. Fork drift, a copy growing
away from this template, is not a defect and is not checked: the code is the fork's.
