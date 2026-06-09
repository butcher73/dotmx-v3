"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  qrData: string;
  size?: number;
}

export const QRCodeDisplay = ({ qrData, size = 200 }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && qrData) {
      QRCode.toCanvas(
        canvasRef.current,
        qrData,
        {
          width: size,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        }
      );
    }
  }, [qrData, size]);

  return (
    <div className="border-border bg-background-elevated rounded-xl border p-4">
      <canvas ref={canvasRef} className="h-48 w-48" />
    </div>
  );
};
