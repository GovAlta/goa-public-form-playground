import { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoabText, GoabBadge, GoabCallout, GoabButton } from "@abgov/react-components";
import { SERVICE_NAME } from "../lib/service";
import { useForm } from "../store/form-store";
import {
  SECTIONS,
  sectionGroups,
  sectionStatus,
  completedCount,
  canSubmit,
  type Section,
  type SectionStatus,
} from "../lib/sections";

/**
 * The task list. Every status is worked out from the answers, in lib/sections.ts; a
 * status that does not move tells a person their work was not saved.
 */

function StatusBadge({ status }: { status: SectionStatus }) {
  switch (status) {
    case "completed":
      return <GoabBadge type="success" content="Completed" />;
    case "in-progress":
      return <GoabBadge type="important" content="In progress" />;
    default:
      return <GoabBadge type="information" content="Not started" />;
  }
}

const rowStyle = (isFirst: boolean): CSSProperties => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--goa-space-m)",
  // The negative horizontal margin cancels the card's padding, so the hover
  // background spans the full width of the card and the whole row is the target.
  padding: "var(--goa-space-m) var(--goa-space-xl)",
  margin: "0 calc(-1 * var(--goa-space-xl))",
  borderTop: isFirst ? "none" : "1px solid var(--goa-color-greyscale-100)",
  textDecoration: "none",
  color: "inherit",
});

function TaskRow({ section, index }: { section: Section; index: number }) {
  const { state } = useForm();
  const status = sectionStatus(section, state);
  const locked = status === "cannot-start";

  // A locked row is not a link and carries no badge: looking clickable and refusing
  // the click is worse than plainly not being available. The group's note says what to do.
  if (locked) {
    return (
      <div style={{ ...rowStyle(index === 0), color: "var(--goa-color-text-secondary)" }}>
        <span>{section.title}</span>
      </div>
    );
  }

  return (
    <Link to={section.route} className="pf-task-row" style={rowStyle(index === 0)}>
      <span className="pf-task-name">{section.title}</span>
      <StatusBadge status={status} />
    </Link>
  );
}

function SectionCard({
  title,
  sections,
  number,
}: {
  title: string;
  sections: Section[];
  number: number;
}) {
  const { state } = useForm();
  const allLocked = sections.every((s) => !s.isUnlocked(state));

  return (
    <div
      style={{
        border: "1px solid var(--goa-color-greyscale-200)",
        borderRadius: "var(--goa-border-radius-xl)",
        padding: "var(--goa-space-l) var(--goa-space-xl)",
        marginBottom: "var(--goa-space-l)",
      }}
    >
      <GoabText tag="h2" mt="none" mb={allLocked ? "xs" : "s"}>
        {number}. {title}
      </GoabText>

      {/* Say what to do, not just that the door is shut. */}
      {allLocked && (
        <GoabText mt="none" mb="none" color="secondary">
          Check if you can apply before you start these.
        </GoabText>
      )}

      {sections.map((section, i) => (
        <TaskRow key={section.id} section={section} index={i} />
      ))}
    </div>
  );
}

export function TaskList() {
  const { state } = useForm();
  const navigate = useNavigate();
  const groups = sectionGroups();
  const done = completedCount(state);
  const total = SECTIONS.length;
  const ready = canSubmit(state);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--goa-space-s)",
          marginBottom: "var(--goa-space-2xs)",
        }}
      >
        <GoabText tag="h1" mt="none" mb="none">
          {SERVICE_NAME}
        </GoabText>
        <GoabBadge type="information" content="Draft" />
      </div>

      <GoabCallout
        type={ready ? "success" : "information"}
        heading={
          ready ? "Ready to submit" : `You have completed ${done} of ${total} sections`
        }
        mt="l"
        mb="xl"
      >
        {ready
          ? "Check your answers before you send your application."
          : "Your progress is saved automatically. You can come back and finish this later."}
      </GoabCallout>

      {groups.map((group, i) => (
        <SectionCard
          key={group.title}
          title={group.title}
          sections={group.sections}
          number={i + 1}
        />
      ))}

      {/*
        Live whether or not the application is finished, changed from disabled on
        purpose: a greyed-out button cannot be focused and tells nobody why. The review
        page explains what is left. The label is the review page's own heading.
      */}
      <GoabButton type="primary" mt="l" onClick={() => navigate("/review")}>
        Check your answers
      </GoabButton>
    </div>
  );
}
