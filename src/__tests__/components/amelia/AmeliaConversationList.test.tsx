// src/__tests__/components/amelia/AmeliaConversationList.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

import AmeliaConversationList from "@/components/amelia/AmeliaConversationList";

const CONVERSATIONS = [
  { id: "c1", title: "Thumb swelling", updatedAt: "2026-08-01T10:00:00.000Z" },
  { id: "c2", title: "Sleep trouble", updatedAt: "2026-08-02T10:00:00.000Z" },
];

function renderList(props: Partial<React.ComponentProps<typeof AmeliaConversationList>> = {}) {
  const onSelect = jest.fn();
  const onNew = jest.fn();
  const onDelete = jest.fn();
  const utils = render(
    <AmeliaConversationList
      conversations={CONVERSATIONS}
      onSelect={onSelect}
      onNew={onNew}
      onDelete={onDelete}
      {...props}
    />
  );
  return { ...utils, onSelect, onNew, onDelete };
}

beforeEach(() => {
  localStorage.clear();
});

describe("AmeliaConversationList — collapsible rail", () => {
  it("starts collapsed and hides the conversation titles", () => {
    renderList({ collapsible: true });

    expect(screen.getByLabelText("Expand chat history")).toBeInTheDocument();
    expect(screen.queryByText("Thumb swelling")).not.toBeInTheDocument();
  });

  it("collapses to 68px and expands to 280px", () => {
    const { container } = renderList({ collapsible: true });
    const aside = container.querySelector("aside")!;

    expect(aside).toHaveStyle({ width: "68px" });

    fireEvent.click(screen.getByLabelText("Expand chat history"));
    expect(aside).toHaveStyle({ width: "280px" });
  });

  it("reveals the titles once expanded", () => {
    renderList({ collapsible: true });

    fireEvent.click(screen.getByLabelText("Expand chat history"));

    expect(screen.getByText("Thumb swelling")).toBeInTheDocument();
    expect(screen.getByText("Sleep trouble")).toBeInTheDocument();
    expect(screen.getByLabelText("Collapse chat history")).toBeInTheDocument();
  });

  it("persists the expanded state across remounts", () => {
    const { unmount } = renderList({ collapsible: true });
    fireEvent.click(screen.getByLabelText("Expand chat history"));
    unmount();

    renderList({ collapsible: true });
    expect(screen.getByText("Thumb swelling")).toBeInTheDocument();
  });

  it("still selects a conversation while collapsed", () => {
    const { onSelect } = renderList({ collapsible: true });

    // Titles are hidden, so the row is reachable by its tooltip instead.
    fireEvent.click(screen.getByTitle("Thumb swelling"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("starts a new chat from the collapsed rail", () => {
    const { onNew } = renderList({ collapsible: true });

    fireEvent.click(screen.getByTitle("New chat"));
    expect(onNew).toHaveBeenCalled();
  });
});

describe("AmeliaConversationList — overlay rail (chat bubble)", () => {
  it("retracts to zero width so it never covers a message", () => {
    const { container } = renderList({ overlay: true });
    const aside = container.querySelector("aside")!;

    expect(aside).toHaveStyle({ width: "0px" });
    expect(aside.className).toContain("absolute");
    // No 68px strip means no leftover divider over the transcript either.
    expect(aside.className).not.toContain("border-r");
  });

  it("drops its contents from the tree while retracted", () => {
    renderList({ overlay: true });

    // Nothing clipped-but-focusable should remain behind.
    expect(screen.queryByLabelText("Past conversations")).not.toBeInTheDocument();
    expect(screen.queryByTitle("New chat")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Collapse chat history")).not.toBeInTheDocument();
  });

  it("reopens from the floating button once retracted", () => {
    const { container } = renderList({ overlay: true });
    expect(screen.queryByLabelText("Close chat history")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Expand chat history"));

    expect(container.querySelector("aside")).toHaveStyle({ width: "280px" });
    expect(screen.getByText("Thumb swelling")).toBeInTheDocument();
    // The floating opener yields to the rail's own collapse control.
    expect(screen.queryByLabelText("Expand chat history")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Collapse chat history")).toBeInTheDocument();
  });

  it("retracts fully again when the scrim is clicked", () => {
    const { container } = renderList({ overlay: true });
    fireEvent.click(screen.getByLabelText("Expand chat history"));

    fireEvent.click(screen.getByLabelText("Close chat history"));

    expect(container.querySelector("aside")).toHaveStyle({ width: "0px" });
    expect(screen.queryByText("Thumb swelling")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expand chat history")).toBeInTheDocument();
  });

  it("keeps its collapsed state separate from the full-page rail", () => {
    // Expanding the bubble must not expand the page sidebar too.
    const { unmount } = renderList({ overlay: true });
    fireEvent.click(screen.getByLabelText("Expand chat history"));
    unmount();

    const { container } = renderList({ collapsible: true });
    // Still the 68px in-flow strip, not the 280px expanded panel.
    expect(container.querySelector("aside")).toHaveStyle({ width: "68px" });
    expect(screen.queryByText("Thumb swelling")).not.toBeInTheDocument();
  });
});

describe("AmeliaConversationList — inline variant", () => {
  it("shows titles and no collapse toggle by default", () => {
    renderList();

    expect(screen.getByText("Thumb swelling")).toBeInTheDocument();
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.queryByLabelText("Expand chat history")).not.toBeInTheDocument();
  });
});
