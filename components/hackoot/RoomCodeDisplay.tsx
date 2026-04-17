"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface RoomCodeDisplayProps {
  code: string;
}

export function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span
        className="font-mono font-semibold text-[var(--text-primary)] tracking-[0.15em]"
        style={{
          fontSize: "clamp(2rem, 5vw, 4rem)",
        }}
      >
        {code}
      </span>
      <button
        onClick={handleCopy}
        className="p-2 rounded-lg glass-card hover:bg-white/10 transition-colors"
        aria-label={copied ? "Copied!" : "Copy room code"}
      >
        {copied ? (
          <Check className="w-6 h-6 text-[#10B981]" />
        ) : (
          <Copy className="w-6 h-6 text-[var(--text-primary)]" />
        )}
      </button>
    </div>
  );
}
