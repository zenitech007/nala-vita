import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInput from "@/components/chat/ChatInput";

const onChange = jest.fn();
const onSend = jest.fn();

beforeEach(() => {
  onChange.mockClear();
  onSend.mockClear();
});

describe("ChatInput", () => {
  it("renders the textarea and send button", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls onChange on typing", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalledWith("hi");
  });

  it("disables send when value is empty and no image", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("enables send when value has content", () => {
    render(<ChatInput value="hello" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("calls onSend on send button click", () => {
    render(<ChatInput value="hello" onChange={onChange} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalled();
  });
});
