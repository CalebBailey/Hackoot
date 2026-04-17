"use client";

import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { useRef } from "react";

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 200 }: QrCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "hackoot-qr-code.png";
      a.click();
    };

    img.src = url;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={qrRef}
        className="p-4 bg-white rounded-xl"
      >
        <QRCodeSVG
          value={value}
          size={size - 32}
          level="M"
          bgColor="transparent"
          fgColor="#000000"
        />
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 text-sm glass-card hover:bg-white/10 transition-colors text-[var(--text-primary)]"
        aria-label="Download QR code"
      >
        <Download className="w-4 h-4" />
        Download QR
      </button>
    </div>
  );
}
