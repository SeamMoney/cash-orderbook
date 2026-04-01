"use client";

import { useRef, useEffect, useCallback } from "react";
import type { DepthLevel } from "@/hooks/use-depth";

interface DepthChartProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

/**
 * DepthChart — Canvas-based area chart.
 * Bid curve (emerald-500/15) from mid to left, ask curve (rose-500/15) from mid to right.
 * Cumulative depth on Y axis. Responsive to container size.
 */
export function DepthChart({ bids, asks }: DepthChartProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback((): void => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, bottom: 20, left: 10, right: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const midX = padding.left + chartW / 2;
    const baseY = padding.top + chartH;

    // Find max cumulative depth for Y scaling
    const maxBidDepth = bids.length > 0 ? bids[bids.length - 1].total : 0;
    const maxAskDepth = asks.length > 0 ? asks[asks.length - 1].total : 0;
    const maxDepth = Math.max(maxBidDepth, maxAskDepth, 1);

    const scaleY = chartH / maxDepth;

    // Draw grid lines
    ctx.strokeStyle = "#2A2A2A";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = baseY - (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw center line
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(midX, padding.top);
    ctx.lineTo(midX, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bid curve (green, from mid to left)
    if (bids.length > 0) {
      const stepX = (chartW / 2) / Math.max(bids.length, 1);

      // Fill area
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.beginPath();
      ctx.moveTo(midX, baseY);

      bids.forEach((level, i) => {
        const x = midX - (i + 1) * stepX;
        const y = baseY - level.total * scaleY;
        if (i === 0) {
          ctx.lineTo(midX, baseY - level.total * scaleY);
        }
        ctx.lineTo(x, y);
      });

      ctx.lineTo(midX - bids.length * stepX, baseY);
      ctx.closePath();
      ctx.fill();

      // Stroke line
      ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      bids.forEach((level, i) => {
        const x = midX - (i + 1) * stepX;
        const y = baseY - level.total * scaleY;
        if (i === 0) {
          ctx.moveTo(midX, baseY - level.total * scaleY);
        }
        ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw ask curve (red, from mid to right)
    if (asks.length > 0) {
      const stepX = (chartW / 2) / Math.max(asks.length, 1);

      // Fill area
      ctx.fillStyle = "rgba(244, 63, 94, 0.15)";
      ctx.beginPath();
      ctx.moveTo(midX, baseY);

      asks.forEach((level, i) => {
        const x = midX + (i + 1) * stepX;
        const y = baseY - level.total * scaleY;
        if (i === 0) {
          ctx.lineTo(midX, baseY - level.total * scaleY);
        }
        ctx.lineTo(x, y);
      });

      ctx.lineTo(midX + asks.length * stepX, baseY);
      ctx.closePath();
      ctx.fill();

      // Stroke line
      ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      asks.forEach((level, i) => {
        const x = midX + (i + 1) * stepX;
        const y = baseY - level.total * scaleY;
        if (i === 0) {
          ctx.moveTo(midX, baseY - level.total * scaleY);
        }
        ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "10px var(--font-geist-mono), monospace";
    ctx.textAlign = "left";
    ctx.fillText("Bids", padding.left + 4, padding.top + 12);
    ctx.textAlign = "right";
    ctx.fillText("Asks", width - padding.right - 4, padding.top + 12);

    // Y-axis depth labels
    ctx.fillStyle = "#444444";
    ctx.textAlign = "left";
    ctx.font = "9px var(--font-geist-mono), monospace";
    for (let i = 1; i <= 4; i++) {
      const depthVal = (maxDepth / 4) * i;
      const y = baseY - (chartH / 4) * i;
      const label =
        depthVal >= 1000
          ? `${(depthVal / 1000).toFixed(1)}K`
          : depthVal.toFixed(0);
      ctx.fillText(label, padding.left + 2, y - 2);
    }
  }, [bids, asks]);

  useEffect(() => {
    draw();

    const handleResize = (): void => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[160px]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {bids.length === 0 && asks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/38">
          No depth data
        </div>
      )}
    </div>
  );
}
