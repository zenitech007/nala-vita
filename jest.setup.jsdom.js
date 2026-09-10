// jsdom ships without TextEncoder/TextDecoder, which the SSE stream reader in
// AmeliaChat needs to decode chunks. Borrow Node's implementations.
const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;

// jsdom does not implement Element.prototype.scrollIntoView at all. Chat views
// call it on a sentinel div to follow new messages.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom does not implement Element.prototype.scrollTo — it exists on window only.
// Components that follow streaming content (see useStickToBottom) call it on the
// scroll container, so provide a no-op that also keeps scrollTop coherent.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo(options) {
    if (typeof options === "object" && options !== null && typeof options.top === "number") {
      this.scrollTop = options.top;
    }
  };
}
