"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center w-full animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex gap-1.5 bg-gray-50 dark:bg-[#2B2D31] px-4 py-3.5 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
        <span
          className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
