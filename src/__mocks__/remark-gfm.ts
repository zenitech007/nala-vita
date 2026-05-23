// Test-time stand-in for `remark-gfm` (ESM-only at runtime).
// Returns a no-op plugin shape so any `remarkPlugins` arrays stay valid.
const remarkGfmMock = () => () => {};
export default remarkGfmMock;
