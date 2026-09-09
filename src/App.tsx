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
// The event detail type ships in ui-components-common, which is why that package is a dependency.
import type { GoabMenuButtonOnActionDetail } from "@abgov/ui-components-common";

import { SERVICE_NAME } from "./lib/service";
import { useForm, startNewApplication } from "./store/form-store";

/** A sliver of footer above the fold, so a short page reads as finished rather than clipped. */
const FOOTER_HAIRLINE = "3px";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Publishes the header's height as --pf-header-height so the content region can subtract
 * it. Observed rather than hardcoded: GoabAppHeader grows when a fork adds nav links or
 * opens its menu on a small screen.
 */
function useHeaderHeight() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;

    const publish = () => {
      const { height } = header.getBoundingClientRect();
      document.documentElement.style.setProperty(
        "--pf-header-height",
        `${Math.round(height)}px`,
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function App() {
  // GoabAppHeader takes a plain href, so it needs the deploy's base path; BASE_URL is
  // what CI derived from the repository name, so the logo link is right in every fork.
  const home = import.meta.env.BASE_URL;
  const headerRef = useHeaderHeight();
  const { dispatch } = useForm();
  const navigate = useNavigate();

  // DEMO ONLY: delete this handler and the "Demo: clear answers" item below.
  // Deliberately not wired to "Sign out": signing out of a real service keeps the draft.
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
              <GoabMenuAction
                text="Demo: clear answers (refresh restores)"
                action="reset-demo"
              />
            </GoabMenuButton>
          </div>
        </GoabAppHeader>
      </section>

      <GoabPageBlock width="640px">
        {/*
          The first viewport belongs to the question: hold the content region to one
          viewport minus the header, so the footer starts at the fold instead of sitting
          beside a one-question page. vh rather than dvh, so mobile browser chrome showing
          and hiding does not reflow the page under someone's finger. See docs/design-notes.md.
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
        {/* The meta section lays links out horizontally; the nav section would stack them. */}
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
