import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ChatMessage from "@/components/chat/ChatMessage";

describe("ChatMessage", () => {
  it("right-aligns when isMine=true", () => {
    const { container } = render(
      <ChatMessage isMine={true} content="Hi" sentAt="2026-05-22T10:00:00Z" />
    );
    // The outer flex row should reverse so the bubble sits on the right
    expect(container.innerHTML).toMatch(/flex-row-reverse|justify-end|self-end|ml-auto/);
  });

  it("shows the other-party avatar with initials when isMine=false", () => {
    render(
      <ChatMessage
        isMine={false}
        content="Hi"
        sentAt="2026-05-22T10:00:00Z"
        otherInitials="DR"
      />
    );
    expect(screen.getByText("DR")).toBeInTheDocument();
  });

  it("renders content text", () => {
    render(
      <ChatMessage isMine={true} content="Hello there" sentAt="2026-05-22T10:00:00Z" />
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders an image when imageUrl is provided", () => {
    render(
      <ChatMessage
        isMine={false}
        content="See this scan"
        imageUrl="https://x.test/scan.png"
        sentAt="2026-05-22T10:00:00Z"
        otherInitials="DR"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://x.test/scan.png");
  });

  it("passes content to the markdown renderer", () => {
    // react-markdown is mocked in tests (ESM compatibility) — assert the raw
    // string reaches it rather than the rendered DOM shape. Real markdown
    // rendering is exercised in production builds.
    render(
      <ChatMessage isMine={true} content="**bold** text" sentAt="2026-05-22T10:00:00Z" />
    );
    expect(screen.getByTestId("react-markdown-mock")).toHaveTextContent("**bold** text");
  });
});
