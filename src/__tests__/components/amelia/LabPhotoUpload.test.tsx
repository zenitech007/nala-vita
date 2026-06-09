// src/__tests__/components/amelia/LabPhotoUpload.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/lib/downscaleImage", () => ({ downscaleImage: jest.fn(async () => "data:image/jpeg;base64,AAA") }));

import LabPhotoUpload from "@/components/amelia/LabPhotoUpload";

function mockFetch(body: unknown, ok = true) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({ ok, json: async () => body })) as unknown as jest.Mock;
}

function pickFile() {
  const input = screen.getByLabelText("lab photo");
  fireEvent.change(input, { target: { files: [new File(["x"], "lab.jpg", { type: "image/jpeg" })] } });
}

beforeEach(() => mockFetch({ results: [{ name: "Glucose", value: "110", unit: "mg/dL", referenceRange: "70-99", flag: "abnormal" }], summary: "Slightly high.", overallNote: "Confirm with your doctor." }));

describe("LabPhotoUpload", () => {
  it("shows the prompt card initially", () => {
    render(<LabPhotoUpload />);
    expect(screen.getByText(/paper lab report/i)).toBeInTheDocument();
  });

  it("reads a picked photo and renders the extracted table + summary", async () => {
    render(<LabPhotoUpload />);
    pickFile();
    await waitFor(() => expect(screen.getByText("Glucose")).toBeInTheDocument());
    expect(screen.getByText(/Slightly high/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm with your doctor/)).toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    mockFetch({ error: "bad" }, false);
    render(<LabPhotoUpload />);
    pickFile();
    await waitFor(() => expect(screen.getByText(/couldn.t read/i)).toBeInTheDocument());
  });
});
