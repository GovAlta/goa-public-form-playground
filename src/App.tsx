import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  GoabOneColumnLayout,
  GoabAppHeader,
  GoabMenuButton,
  GoabMenuAction,
  GoabAppFooter,
  GoabAppFooterMetaSection,
  GoabPageBlock,
} from "@abgov/react-components";
// The event detail type ships in ui-components-common, not in react-components —
// the fourth package this template depends on, and the reason it is not optional.
import type { GoabMenuButtonOnActionDetail } from "@abgov/ui-components-common";

import { SERVICE_NAME } from "./lib/service";
import { useForm, startNewApplication } from "./store/form-store";

/**
 * How much of the footer shows before anyone scrolls.
 *
 * Not zero, deliberately. A page whose content runs exactly to the bottom edge looks
 * cut off, as though the browser clipped it; a sliver of the footer reads as an edge,
 * so the page looks finished rather than truncated. It is small enough to be a frame
 * and not an invitation — nobody mistakes three pixels for content they should read.
 */
const FOOTER_HAIRLINE = "3px";

/**
 * React Router keeps the previous page's scroll position, so navigating to a new
 * question can land you partway down it. Public forms are a sequence of pages, so
 * every navigation should start at the top.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Publish the header's height as --pf-header-height, so the content region below can
 * subtract it.
 *
 * CSS cannot measure one element against another, and the design system does not
 * publish the header's height as a token. The alternative was a hardcoded number,
 * which would be right in this repository and quietly wrong in a fork: this header
 * carries no navigation, and GoabAppHeader grows when a service adds nav links or
 * opens its menu on a small screen. A constant would look correct here and drift
 * everywhere it mattered.
 *
 * Observed rather than measured once, because the height moves for reasons that have
 * nothing to do with navigating: a font finishing loading, a breakpoint, a menu
 * opening. Until the first measurement lands the variable is absent and the fallback
 * of 0px applies, which errs toward the footer sitting too low rather than peeking.
 */
function useHeaderHeight() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;

    const publish = () => {
      const { height } = header.getBoundingClientRect();
      document.documentElement.style.setProperty("--pf-header-height", `${Math.round(height)}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/**
 * The app shell: header, a single 640px content column, footer.
 *
 * Every page renders through the <Outlet />, so the shell is written once. Page
 * level structure (the back link, the heading rhythm) belongs to PublicFormLayout
 * and FormSet, not here.
 */
export function App() {
  // GoabAppHeader takes a plain href rather than a router <Link>, so it needs the
  // deploy's base path. import.meta.env.BASE_URL is the same value CI derived from
  // the repository name, which keeps the logo link correct in every fork.
  const home = import.meta.env.BASE_URL;
  const headerRef = useHeaderHeight();
  const { dispatch } = useForm();
  const navigate = useNavigate();

  /*
   * DEMO ONLY. DELETE THIS HANDLER AND THE "Reset demo" ITEM BELOW.
   *
   * Answers save automatically and they persist, which is right for somebody applying
   * and wrong for somebody evaluating: they open the demo, answer three questions,
   * come back later and land halfway through a form they do not remember starting,
   * with no way back short of clearing browser storage by hand. A saved draft is
   * exactly what stops a demo being re-runnable.
   *
   * Note what this deliberately does NOT do: hang itself off "Sign out". Signing out
   * of a real service KEEPS your draft — that is the whole reason a draft is saved
   * against an account rather than a browser. Wiring sign-out to a wipe would teach
   * the inverse of the thing it looks like it is teaching, and a fork that later adds
   * real authentication would inherit it without noticing. The other three items stay
   * inert on purpose, the same way the footer links do.
   */
  async function handleMenuAction(detail: GoabMenuButtonOnActionDetail) {
    if (detail.action !== "reset-demo") return;
    await startNewApplication(dispatch);
    navigate("/");
  }

  return (
    <GoabOneColumnLayout>
      <section slot="header" ref={headerRef}>
        <GoabAppHeader url={home} heading={SERVICE_NAME} maxContentWidth="704px">
          <div slot="utilities">
            <GoabMenuButton
              text="Edna Mode"
              type="tertiary"
              size="compact"
              onAction={handleMenuAction}
            >
              <GoabMenuAction text="My profile" action="profile" />
              <GoabMenuAction text="Settings" action="settings" />
              <GoabMenuAction text="Sign out" action="sign-out" />
              {/* Last, not first. The design system's guidance is to lead with the most
                  used item, and for a demo that would be this one — but it is not part
                  of the account group above it, and putting it on top would make the
                  chrome read as though wiping your answers is a normal thing to want. */}
              <GoabMenuAction text="Demo: clear answers (refresh restores)" action="reset-demo" />
            </GoabMenuButton>
          </div>
        </GoabAppHeader>
      </section>

      <GoabPageBlock width="640px">
        {/*
          The first viewport belongs to the task.

          The layout pins the footer to the bottom of the viewport on a short page, so
          a one-question page arrives with site chrome sitting right beside the
          question. Holding the content region to a full viewport pushes the footer
          past the fold: the person sees the question and nothing else, and reaches the
          footer only by scrolling to the end, which is where they are done rather than
          where they are working.

          The header's height is subtracted, and that part is not a refinement. A
          content region of a whole viewport sits below a header, so the page becomes
          one viewport plus a header, and the footer starts a header's height past the
          fold. The person scrolls into a band of nothing before anything appears.
          Subtracting it puts the footer exactly at the fold, so it arrives the instant
          they scroll. Measured: a long service name doubles this header at phone
          width, which is why the height is observed rather than written down.

          The hairline comes off the same calculation, so the footer's top edge sits
          three pixels above the fold rather than on it.

          vh rather than dvh, deliberately. dvh tracks the viewport as mobile browser
          chrome shows and hides, so it recalculates mid-scroll and reflows the page —
          content moving under someone's finger while they are filling in a field. vh
          resolves to the largest viewport and never changes, so the footer stays below
          the fold in every chrome state. It slightly overshoots on mobile once the
          address bar is showing, which costs a little extra scrolling; underfitting
          would let the footer peek, which is the thing this rule exists to prevent.
        */}
        <div
          style={{
            minHeight: `calc(100vh - var(--pf-header-height, 0px) - ${FOOTER_HAIRLINE})`,
            paddingTop: "var(--goa-space-2xl)",
            paddingBottom: "var(--goa-space-3xl)",
          }}
        >
          <ScrollToTop />
          <Outlet />
        </div>
      </GoabPageBlock>

      <section slot="footer">
        {/* Links go in the meta section so they lay out horizontally. The nav section
            stacks them into columns, and the footer adds the copyright itself. */}
        <GoabAppFooter>
          <GoabAppFooterMetaSection>
            <a href="#">My profile</a>
            <a href="#">Accessibility</a>
            <a href="#">Privacy</a>
            <a href="#">Terms and conditions</a>
          </GoabAppFooterMetaSection>
        </GoabAppFooter>
      </section>
    </GoabOneColumnLayout>
  );
}
