/**
 * Regression cover for the chat-attachment upload contract.
 *
 * The server was hardened so that attachments are uploaded via
 * POST /api/messages/attachments (private bucket, service role, magic-byte
 * check) which returns an opaque `/api/messages/attachments/<id>` URL. The
 * Zod schema on POST /api/messages then *rejects* anything that is not that
 * shape — see parseChatAttachmentId in api/messages/attachments/shared.ts.
 *
 * ChatWindow was originally left uploading straight to Supabase storage and
 * sending back a public URL, so every attachment send failed validation with a
 * 400. These tests pin the client to the real contract.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ChatWindow from "@/components/chat/ChatWindow";
import { parseChatAttachmentId } from "@/app/api/messages/attachments/shared";

const channelSend = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
      unsubscribe: jest.fn(),
      send: (...args: unknown[]) => channelSend(...args),
    }),
    storage: {
      from: () => {
        throw new Error(
          "ChatWindow must not upload directly to Supabase storage — " +
            "use POST /api/messages/attachments"
        );
      },
    },
  },
}));

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "scan.png", {
  type: "image/png",
});

const props = {
  currentUserId: "user-1",
  otherUserId: "user-2",
  otherUserName: "Dr Johnson",
  otherUserRole: "DOCTOR",
};

/** Resolves the fetch mock for a given URL/method pair. */
type Handler = (url: string, init?: RequestInit) => unknown;

function mockFetch(handler: Handler) {
  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const result = handler(url, init) as
      | { status?: number; body?: unknown }
      | undefined;
    const status = result?.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result?.body ?? {},
    };
  }) as unknown as typeof fetch;
}

function selectFile(file: File) {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

/** The composer's send button is the only submit control with no text label. */
function clickSend() {
  const buttons = Array.from(document.querySelectorAll("button"));
  const send = buttons[buttons.length - 1];
  fireEvent.click(send);
}

async function attachAndSend(file: File = PNG) {
  selectFile(file);
  await waitFor(() =>
    expect(screen.getByText(file.name)).toBeInTheDocument()
  );
  clickSend();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ChatWindow attachments", () => {
  it("uploads via /api/messages/attachments and sends the opaque URL", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];

    mockFetch((url, init) => {
      calls.push({ url, init });
      if (url.startsWith("/api/messages/attachments")) {
        return {
          status: 201,
          body: {
            attachment: {
              id: "file-abc",
              url: "/api/messages/attachments/file-abc",
              fileName: "scan.png",
              fileSize: 4,
              mimeType: "image/png",
            },
          },
        };
      }
      if (url.startsWith("/api/messages?")) return { body: { messages: [] } };
      if (url === "/api/messages") {
        return {
          status: 201,
          body: {
            message: {
              id: "m1",
              senderId: "user-1",
              receiverId: "user-2",
              content: "Sent a file: scan.png",
              isRead: false,
              attachmentUrl: "/api/messages/attachments/file-abc",
              createdAt: new Date("2026-08-06T10:00:00Z").toISOString(),
            },
          },
        };
      }
      return { body: {} };
    });

    render(<ChatWindow {...props} />);
    await waitFor(() =>
      expect(screen.queryByText(/no messages yet/i)).toBeInTheDocument()
    );

    await attachAndSend();

    const upload = await waitFor(() => {
      const found = calls.find(
        (c) =>
          c.url === "/api/messages/attachments" && c.init?.method === "POST"
      );
      if (!found) throw new Error("no upload call yet");
      return found;
    });

    // Multipart, carrying the file and the receiver it is scoped to.
    const body = upload.init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(PNG);
    expect(body.get("receiverId")).toBe("user-2");

    // The send must carry the opaque URL the upload returned — and that URL
    // must satisfy the server's own parser.
    const send = await waitFor(() => {
      const found = calls.find(
        (c) => c.url === "/api/messages" && c.init?.method === "POST"
      );
      if (!found) throw new Error("no send call yet");
      return found;
    });
    const sent = JSON.parse(String(send.init?.body));
    expect(sent.attachmentUrl).toBe("/api/messages/attachments/file-abc");
    expect(parseChatAttachmentId(sent.attachmentUrl)).toBe("file-abc");
  });

  it("does not send the message when the upload fails", async () => {
    const posted: string[] = [];

    mockFetch((url, init) => {
      if (init?.method === "POST") posted.push(url);
      if (url.startsWith("/api/messages/attachments")) {
        return { status: 400, body: { error: "Attachment contents do not match its file type" } };
      }
      if (url.startsWith("/api/messages?")) return { body: { messages: [] } };
      return { body: {} };
    });

    render(<ChatWindow {...props} />);
    await waitFor(() =>
      expect(screen.queryByText(/no messages yet/i)).toBeInTheDocument()
    );

    await attachAndSend();

    // The server's reason is surfaced, and no message was created.
    expect(
      await screen.findByText(/contents do not match its file type/i)
    ).toBeInTheDocument();
    expect(posted).not.toContain("/api/messages");
    expect(channelSend).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type before hitting the network", async () => {
    const posted: string[] = [];
    mockFetch((url, init) => {
      if (init?.method === "POST") posted.push(url);
      if (url.startsWith("/api/messages?")) return { body: { messages: [] } };
      return { body: {} };
    });

    render(<ChatWindow {...props} />);
    await waitFor(() =>
      expect(screen.queryByText(/no messages yet/i)).toBeInTheDocument()
    );

    await attachAndSend(
      new File(["#!/bin/sh"], "run.sh", { type: "application/x-sh" })
    );

    expect(await screen.findByText(/only jpeg, png, gif/i)).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("surfaces a thread load failure instead of failing silently", async () => {
    mockFetch((url) => {
      if (url.startsWith("/api/messages?")) {
        return { status: 500, body: { error: "boom" } };
      }
      return { body: {} };
    });

    render(<ChatWindow {...props} />);

    expect(
      await screen.findByText(/messages could not be loaded/i)
    ).toBeInTheDocument();
  });
});
