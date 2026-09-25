"use client";
import { useEffect, useRef, useState } from "react";
import {
  RotateCw,
  ScanLine,
  Expand,
  Check,
  X,
  LoaderCircle,
} from "lucide-react";
import type { ColorMode, Page, Quad } from "@/lib/types";
import { fullQuad, rotateQuad, validQuad } from "@/lib/geometry";
import { processImage } from "@/lib/processing";
export default function BoundaryEditor({
  page,
  colorMode,
  onCancel,
  onConfirm,
}: {
  page: Page;
  colorMode: ColorMode;
  onCancel: () => void;
  onConfirm: (corners: Quad, rotation: number) => void;
}) {
  const [rotation, setRotation] = useState(page.rotation),
    [corners, setCorners] = useState<Quad>(
      page.corners || fullQuad(page.width, page.height),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const w = rotation % 180 ? page.height : page.width,
    h = rotation % 180 ? page.width : page.height;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  useEffect(() => {
    let active = true;
    createImageBitmap(page.source).then((bitmap) => {
      if (active && canvas.current) {
        const c = canvas.current;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      }
      bitmap.close();
    });
    return () => {
      active = false;
    };
  }, [page.source, rotation, w, h]);
  async function detect() {
    setBusy(true);
    setError("");
    try {
      const r = await processImage(page.source, "detect", rotation);
      setCorners(r.corners);
      if (!r.detected)
        setError("Không tìm thấy viền tài liệu. Đã giữ toàn bộ ảnh.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        ref={dialog}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onCancel();
          if (e.key === "Tab") {
            const list = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [tabindex="0"]',
            );
            if (!list?.length) return;
            const first = list[0],
              last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="editor-heading">
          <div>
            <span className="eyebrow">CHỈNH TÀI LIỆU</span>
            <h2 id="editor-title">Chỉnh vùng scan</h2>
            <p>
              Kéo 4 góc theo mép giấy. Bấm Xác nhận để cắt và làm phẳng vùng đã
              căn thành trang chữ nhật.
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Đóng"
            onClick={onCancel}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <div className="editing-area">
          <div
            className="image-stage"
            style={{
              aspectRatio: `${w}/${h}`,
              width: `min(100%, ${Math.round((52 * w) / h)}vh)`,
            }}
          >
            <canvas ref={canvas} />
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
              <path
                d={`M0 0H${w}V${h}H0Z M${corners.map((p) => `${p.x} ${p.y}`).join("L")}Z`}
                fill="rgba(8,20,20,.58)"
                fillRule="evenodd"
              />
              <polygon
                points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="rgba(37,184,136,.07)"
                stroke="#55e3b2"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {corners.map((p, i) => (
              <button
                key={i}
                className="corner"
                disabled={busy}
                aria-label={`Góc ${i + 1}, dùng phím mũi tên để chỉnh`}
                style={{
                  left: `${(p.x / w) * 100}%`,
                  top: `${(p.y / h) * 100}%`,
                }}
                onKeyDown={(e) => {
                  const delta: { [key: string]: [number, number] } = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  if (!delta[e.key]) return;
                  e.preventDefault();
                  const [dx, dy] = delta[e.key];
                  const next = corners.map((v, j) =>
                    j === i
                      ? {
                          x: Math.max(
                            0,
                            Math.min(w - 1, v.x + dx * (e.shiftKey ? 10 : 1)),
                          ),
                          y: Math.max(
                            0,
                            Math.min(h - 1, v.y + dy * (e.shiftKey ? 10 : 1)),
                          ),
                        }
                      : v,
                  ) as Quad;
                  if (validQuad(next, w, h)) setCorners(next);
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const rect =
                    e.currentTarget.parentElement!.getBoundingClientRect();
                  const next = corners.map((v, j) =>
                    j === i
                      ? {
                          x: Math.max(
                            0,
                            Math.min(
                              w - 1,
                              ((e.clientX - rect.left) / rect.width) * w,
                            ),
                          ),
                          y: Math.max(
                            0,
                            Math.min(
                              h - 1,
                              ((e.clientY - rect.top) / rect.height) * h,
                            ),
                          ),
                        }
                      : v,
                  ) as Quad;
                  if (validQuad(next, w, h)) setCorners(next);
                }}
                onPointerUp={(e) =>
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
              >
                <span />
              </button>
            ))}
          </div>
        </div>
        <div className="editor-tools">
          <button
            disabled={busy}
            onClick={() => {
              setCorners(rotateQuad(corners, h));
              setRotation((rotation + 90) % 360);
            }}
          >
            <RotateCw size={17} />
            Xoay 90°
          </button>
          <button disabled={busy} onClick={detect}>
            <ScanLine size={17} />
            Tự động tìm viền
          </button>
          <button disabled={busy} onClick={() => setCorners(fullQuad(w, h))}>
            <Expand size={17} />
            Chọn toàn bộ
          </button>
        </div>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <span>
            {colorMode === "paper"
              ? "Scan giấy · giữ dấu đỏ, bút xanh"
              : "Giữ nguyên màu sắc gốc"}
          </span>
          <button disabled={busy} onClick={onCancel}>
            Hủy
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onConfirm(corners, rotation)}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Check size={18} />
            )}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
