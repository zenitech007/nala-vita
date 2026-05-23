import { describe, it, expect } from "@jest/globals";
import { render } from "@testing-library/react";
import TypingIndicator from "@/components/chat/TypingIndicator";

describe("TypingIndicator", () => {
  it("renders three animated dots", () => {
    const { container } = render(<TypingIndicator />);
    expect(container.querySelectorAll(".animate-bounce")).toHaveLength(3);
  });
});
