"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  signedUrl: string;
}

interface FileUploadProps {
  category?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
}

// ─── Component ──────────────────────────────────────────

export default function FileUpload({
  category = "general",
  onUploadComplete,
  maxSizeMB = 10,
  accept = "image/jpeg,image/png,image/gif,image/webp,application/pdf",
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Drag handlers ─────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category]
  );

  // ─── Upload logic ──────────────────────────────────────

  async function handleFileSelect(file: File) {
    setError(null);

    // Client-side validation
    const allowedTypes = accept.split(",").map((t) => t.trim());
    if (!allowedTypes.includes(file.type)) {
      setError("File type not supported. Please upload an image or PDF.");
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMB} MB.`);
      return;
    }

    setUploading(true);
    setProgress(0);

    // Simulate progress for UX (actual upload is a single POST)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 150);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setProgress(100);

      const uploaded: UploadedFile = {
        id: data.file.id,
        fileName: data.file.fileName,
        fileSize: data.file.fileSize,
        mimeType: data.file.mimeType,
        signedUrl: data.file.signedUrl,
      };

      setUploadedFiles((prev) => [uploaded, ...prev]);
      onUploadComplete?.(uploaded);

      // Reset progress after short delay
      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 800);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(0);
      setUploading(false);
    }
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition cursor-pointer",
          isDragging
            ? "border-[var(--primary)] bg-[var(--primary)]/10"
            : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
          className="hidden"
        />

        {uploading ? (
          <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin mb-3" />
        ) : (
          <Upload
            className={cn(
              "w-10 h-10 mb-3",
              isDragging ? "text-[var(--primary)]" : "text-gray-400"
            )}
          />
        )}

        <p className="text-sm font-medium text-gray-700">
          {isDragging
            ? "Drop file here"
            : uploading
            ? "Uploading..."
            : "Drag & drop a file, or click to browse"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Images & PDFs up to {maxSizeMB} MB
        </p>

        {/* Progress Bar */}
        {uploading && (
          <div className="w-full max-w-xs mt-4">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">
              {progress}%
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Uploaded Files (Thumbnail Previews) */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Uploaded Files</p>
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
            >
              {/* Thumbnail / Icon */}
              {isImage(file.mimeType) ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.signedUrl}
                    alt={file.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(file.fileSize)}
                </p>
              </div>

              {/* Status + remove */}
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
