import React from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

// Registers the goa-* custom elements the React wrappers render.
import "@abgov/web-components";

import { App } from "./App";
import { FormProvider } from "./store/form-store";
import { TaskList } from "./routes/task-list";
import { EligibilitySection } from "./sections/eligibility/pages";
import { AboutYouSection } from "./sections/about-you/pages";
import { YourChildrenSection } from "./sections/your-children/pages";
import { DocumentsSection } from "./sections/documents/pages";
import { NotEligible } from "./sections/eligibility/not-eligible";
import { EditableOnly, UnlockedOnly } from "./routes/guards";
import { ReviewPage } from "./routes/review-page";
import { ConfirmationPage } from "./routes/confirmation-page";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* basename is the value CI wrote into VITE_BASE_PATH, so the router and the asset
        paths never disagree and a fork needs no edits. */}
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "")}
      // v7 behaviours opted into now, so a fork does not start life with deprecation warnings.
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <FormProvider>
        <Routes>
          <Route path="/" element={<App />}>
            {/* Everything inside closes the moment the application is submitted. A new
                question page goes here and inherits the rule. */}
            <Route element={<EditableOnly />}>
              <Route index element={<TaskList />} />

              {/* The sections the screener gates. The task list and the review stay outside:
                  they are how a person finds out what is shut and why. */}
              <Route element={<UnlockedOnly />}>
                <Route path="eligibility/*" element={<EligibilitySection />} />
                <Route path="about-you/*" element={<AboutYouSection />} />
                <Route path="your-children/*" element={<YourChildrenSection />} />
                <Route path="documents/*" element={<DocumentsSection />} />
              </Route>

              <Route path="review" element={<ReviewPage />} />
            </Route>

            {/* Outside the group: the two pages that are the end of a road. */}
            <Route path="not-eligible" element={<NotEligible />} />
            <Route path="confirmation" element={<ConfirmationPage />} />
          </Route>
        </Routes>
      </FormProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
