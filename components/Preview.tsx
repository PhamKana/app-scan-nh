"use client";
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  ScanLine,
  Check,
  LoaderCircle,
  RotateCcw,
  GripVertical,
} from "lucide-react";
import type { Page } from "@/lib/types";
import { usePageDrag } from "@/lib/usePageDrag";
export default function Preview({
  pages,
  locked,
  onEdit,
  onRemove,
  onMove,
  onRetry,
  onReorder,
}: {
  pages: Page[];
  locked: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, d: number) => void;
  onRetry: (id: string) => void;
  onReorder: (from: string, to: string) => void;
}) {
  const { drag, announcement, handlers } = usePageDrag(locked, onReorder);
  return (
    <>
      {pages.length > 1 && (
        <p className="drag-hint" id="page-drag-hint">
          <GripVertical size={16} />
          Giữ nút kéo ở góc ảnh và thả lên trang khác để đổi thứ tự.
        </p>
      )}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <div className={`gallery ${drag ? "is-sorting" : ""}`}>
        {pages.map((p, i) => (
          <article
            className={`page-card ${drag?.id === p.id ? "is-dragging" : ""} ${drag?.target === p.id && drag.id !== p.id ? "drop-target" : ""}`}
            data-page-id={p.id}
            key={p.id}
          >
            <div className="thumbnail">
              <span className="page-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              {pages.length > 1 && (
                <button
                  className="page-drag-handle"
                  disabled={locked}
                  aria-label={`Kéo để di chuyển trang ${i + 1}`}
                  aria-describedby="page-drag-hint"
                  title="Kéo thả để sắp xếp; dùng phím mũi tên để di chuyển"
                  {...handlers(p.id)}
                  onKeyDown={(event) => {
                    if (locked || drag) return;
                    const direction =
                      event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -1
                        : event.key === "ArrowRight" ||
                            event.key === "ArrowDown"
                          ? 1
                          : 0;
                    if (direction) {
                      event.preventDefault();
                      if (i + direction >= 0 && i + direction < pages.length)
                        onMove(p.id, direction);
                    }
                  }}
                >
                  <GripVertical size={21} />
                </button>
              )}
              {/* Browser blob URLs deliberately use native img. */}
              {(p.resultUrl || p.preview) && (
                <img
                  src={p.resultUrl || p.preview}
                  draggable={false}
                  alt={`Tài liệu ${i + 1}: ${p.name}`}
                />
              )}
              {(p.status === "processing" || p.status === "queued") && (
                <div className="processing">
                  <LoaderCircle className="spin" />
                  Đang xử lý…
                </div>
              )}
            </div>
            <div className="card-info">
              <h3 title={p.name}>{p.name}</h3>
              <span className={`status ${p.status}`}>
                {p.status === "done" ? (
                  <>
                    <Check size={14} />
                    Đã scan
                  </>
                ) : p.status === "pending" ? (
                  "Chờ xác nhận"
                ) : p.status === "error" ? (
                  "Cần thử lại"
                ) : (
                  "Đang chuẩn bị"
                )}
              </span>
              {p.notice && <p className="notice">{p.notice}</p>}
              {p.error && <p className="error-text">{p.error}</p>}
              <div className="card-actions">
                <button
                  disabled={locked || p.status === "error"}
                  onClick={() => onEdit(p.id)}
                >
                  <ScanLine size={15} />
                  Chỉnh vùng scan
                </button>
                {p.status === "error" && (
                  <button
                    disabled={locked}
                    aria-label="Thử lại"
                    onClick={() => onRetry(p.id)}
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
                <button
                  disabled={locked}
                  aria-label={`Xóa trang ${i + 1}`}
                  onClick={() => onRemove(p.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="reorder">
                <span>Trang {i + 1}</span>
                <button
                  disabled={locked || i === 0}
                  aria-label={`Chuyển trang ${i + 1} sang trái`}
                  onClick={() => onMove(p.id, -1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  disabled={locked || i === pages.length - 1}
                  aria-label={`Chuyển trang ${i + 1} sang phải`}
                  onClick={() => onMove(p.id, 1)}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
