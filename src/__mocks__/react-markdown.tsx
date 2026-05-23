// Test-time stand-in for `react-markdown` (ESM-only at runtime).
// Renders the markdown source verbatim inside a div. Real markdown
// transformation happens in the production bundle, not in jest.
import * as React from "react";

interface Props {
  children?: string;
}

export default function ReactMarkdown({ children }: Props) {
  return <div data-testid="react-markdown-mock">{children}</div>;
}
