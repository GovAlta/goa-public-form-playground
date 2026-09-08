import React from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

// Registers the goa-* custom elements the React wrappers render.
import "@abgov/web-components";

import { App } from "./App";
import { FormProvider } from "./store/form-store";
import { TaskList } from "./routes/task-list";
import { EligibilitySection } from "./routes/eligibility/eligibility-section";
import { AboutYouSection } from "./routes/about-you/about-you-section";
import { YourChildrenSection } from "./routes/your-children/your-children-section";
import { DocumentsSection } from "./routes/documents/documents-section";
import { NotEligible } from "./routes/not-eligible";
import { EditableOnly, UnlockedOnly } from "./routes/guards";
import { ReviewPage } from "./routes/review/review-page";
import { ConfirmationPage } from "./routes/review/confirmation-page";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/*
      basename comes from the same value CI wrote into VITE_BASE_PATH, so the router
      and the asset paths can never disagree. This is why a fork needs no edits.
    */}
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "")}
      // Opt in to the v7 behaviours now. A template that starts life printing
      // deprecation warnings teaches every fork to ignore its own console.
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <FormProvider>
        <Routes>
          <Route path="/" element={<App />}>
            {/*
              Everything inside this closes the moment the application is submitted:
              the answers become a record rather than a draft. Adding a question page
              means adding it here, and it inherits the rule by being in the group.
            */}
            <Route element={<EditableOnly />}>
              <Route index element={<TaskList />} />

              {/* And inside that, the sections the screener gates. The task list and
                  the review page sit outside it: they are how a person finds out
                  what is shut and why, so they must stay reachable. */}
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
