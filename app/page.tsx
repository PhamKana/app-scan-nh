"use client";
import { useEffect, useRef, useState } from "react";
import {
  ScanLine,
  Zap,
  SlidersHorizontal,
  ShieldCheck,
  ArrowDownToLine,
  Files,
  Check,
  LoaderCircle,
  ArrowUpRight,
} from "lucide-react";
import Upload from "@/components/Upload";
import Preview from "@/components/Preview";
import BoundaryEditor from "@/components/BoundaryEditor";
import { decodeFile, processImage, resetWorker } from "@/lib/processing";
import { exportPages } from "@/lib/export";
import type { ColorMode, Page, Quad } from "@/lib/types";
export default function Home() {
  const [mode, setMode] = useState<"quick" | "normal">("quick"),
    [colorMode, setColorMode] = useState<ColorMode>("original"),
    [pages, setPages] = useState<Page[]>([]),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState<"pdf" | "jpg" | null>(null),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<string | null>(null);
  const latest = useRef(pages);
  latest.current = pages;
  const running = useRef(false);
  const urls = useRef(new Set<string>());
  const url = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urls.current.add(u);
    return u;
  };
  const revoke = (u?: string) => {
    if (u) {
      URL.revokeObjectURL(u);
      urls.current.delete(u);
    }
  };
  useEffect(() => {
    const owned = urls.current;
    return () => {
      owned.forEach((u) => URL.revokeObjectURL(u));
      resetWorker();
    };
  }, []);
  const update = (id: string, patch: Partial<Page>) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  async function scan(page: Page) {
    update(page.id, { status: "processing", error: undefined });
    try {
      if (!page.width) {
        const decoded = await decodeFile(page.source as File);
        page = {
          ...page,
          source: decoded.blob,
          preview: url(decoded.blob),
          width: decoded.width,
          height: decoded.height,
        };
        update(page.id, {
          source: page.source,
          preview: page.preview,
          width: page.width,
          height: page.height,
        });
      }
      const r = await processImage(
        page.source,
        page.mode === "quick" ? "scan" : "detect",
        0,
        undefined,
        colorMode,
      );
      update(page.id, {
        corners: r.corners,
        detected: r.detected,
        status: page.mode === "quick" ? "done" : "pending",
        result: r.blob,
        resultUrl: r.blob ? url(r.blob) : undefined,
        notice: r.detected
          ? undefined
          : "Không tìm thấy viền tài liệu. Đã giữ toàn bộ ảnh.",
      });
      return true;
    } catch (e) {
      update(page.id, { status: "error", error: (e as Error).message });
      return false;
    }
  }
  async function addFiles(files: File[]) {
    if (running.current || !files.length) return;
    if (latest.current.length + files.length > 20) {
      setError(
        "Tối đa 20 ảnh trong một tài liệu. Hãy xóa bớt ảnh hoặc chia thành nhiều lượt.",
      );
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    const pendingIds: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Đang xử lý ${i + 1}/${files.length} ảnh`);
        const file = files[i];
        const id = crypto.randomUUID();
        try {
          const page: Page = {
            id,
            name: file.name,
            source: file,
            preview: "",
            width: 0,
            height: 0,
            rotation: 0,
            status: "queued",
            mode,
          };
          setPages((prev) => [...prev, page]);
          const success = await scan(page);
          if (success && mode === "normal") pendingIds.push(id);
        } catch (e) {
          setError(
            (prev) =>
              `${prev ? prev + " " : ""}${file.name}: ${(e as Error).message}`,
          );
        }
      }
    } finally {
      setBusy(false);
      running.current = false;
      setProgress("");
      if (pendingIds.length) setEditing(pendingIds[0]);
    }
  }
  const current = pages.find((p) => p.id === editing && p.status !== "error");
  const locked = busy || !!exporting || !!current;
  async function confirm(corners: Quad, rotation: number) {
    if (!current) return;
    const r = await processImage(
      current.source,
      "scan",
      rotation,
      corners,
      colorMode,
    );
    revoke(current.resultUrl);
    update(current.id, {
      corners,
      rotation,
      detected: true,
      result: r.blob,
      resultUrl: url(r.blob!),
      status: "done",
      notice: undefined,
    });
    setEditing(
      pages.find((p) => p.id !== current.id && p.status === "pending")?.id ||
        null,
    );
  }
  const completed = pages.filter((p) => p.status === "done").length;
  async function changeColor(next: ColorMode) {
    if (locked || running.current || next === colorMode) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const results = new Map<string, Blob>();
      for (const [i, page] of pages.entries()) {
        if (page.status !== "done") continue;
        setProgress(`Đang đổi màu ${i + 1}/${pages.length} ảnh`);
        const result = await processImage(
          page.source,
          "scan",
          page.rotation,
          page.detected === false ? undefined : page.corners,
          next,
        );
        results.set(page.id, result.blob!);
      }
      const updated = pages.map((page) => {
        const result = results.get(page.id);
        if (!result) return page;
        revoke(page.resultUrl);
        return { ...page, result, resultUrl: url(result) };
      });
      setPages(updated);
      setColorMode(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Gọn Scan — Trang chủ">
          <span className="brand-icon">
            <ScanLine size={24} />
          </span>
          gọn<span className="brand-light">scan</span>
          <span className="beta">MIỄN PHÍ</span>
        </a>
        <span className="header-privacy">
          <ShieldCheck size={16} />
          Ảnh chỉ ở trên thiết bị của bạn
        </span>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span /> GỌN TÀI LIỆU, NHẸ CÔNG VIỆC
          </div>
          <h1>
            Từ ảnh chụp.
            <br />
            Thành <span>tài liệu chỉn chu.</span>
          </h1>
          <p>
            Cắt đúng viền, chỉnh thẳng trang, chọn màu theo ý bạn.
            <br />
            Scan tài liệu ngay trong trình duyệt — đơn giản và riêng tư.
          </p>
          <div className="benefits">
            <span>
              <Check />
              Màu gốc hoặc scan giấy
            </span>
            <span>
              <Check />
              Không cần tài khoản
            </span>
            <span>
              <Check />
              Xuất JPG & PDF
            </span>
          </div>
        </section>
        <section className="workspace">
          <div className="section-heading">
            <div>
              <span className="step">01</span>
              <h2>Thêm tài liệu của bạn</h2>
            </div>
            <span className="subtle">Bắt đầu bằng một tấm ảnh</span>
          </div>
          <div className="mode-grid">
            <button
              className={`mode ${mode === "quick" ? "selected" : ""}`}
              disabled={locked}
              onClick={() => setMode("quick")}
              aria-pressed={mode === "quick"}
            >
              <span className="mode-icon">
                <Zap />
              </span>
              <span>
                <strong>
                  Scan nhanh <em>TỰ ĐỘNG</em>
                </strong>
                <small>Tự tìm viền và làm thẳng tài liệu</small>
              </span>
              <span className="radio">{mode === "quick" && <span />}</span>
            </button>
            <button
              className={`mode ${mode === "normal" ? "selected" : ""}`}
              disabled={locked}
              onClick={() => setMode("normal")}
              aria-pressed={mode === "normal"}
            >
              <span className="mode-icon">
                <SlidersHorizontal />
              </span>
              <span>
                <strong>Scan bình thường</strong>
                <small>Tự chỉnh bốn góc trước khi scan</small>
              </span>
              <span className="radio">{mode === "normal" && <span />}</span>
            </button>
          </div>
          <div className="color-options" role="group" aria-label="Màu tài liệu">
            <span>Màu tài liệu</span>
            <div className="export-actions">
              {(["original", "paper"] as const).map((value) => (
                <button
                  key={value}
                  className="color-option"
                  aria-pressed={colorMode === value}
                  disabled={locked}
                  onClick={() => changeColor(value)}
                >
                  {value === "original" ? "Màu gốc" : "Scan giấy"}
                </button>
              ))}
            </div>
            <p>
              Scan giấy: nền trắng, chữ rõ, giữ màu dấu đỏ và bút ký xanh biển.
              Áp dụng cho tất cả các trang và file tải xuống.
            </p>
          </div>
          <Upload onFiles={addFiles} disabled={locked} onError={setError} />
          <div className="local-note">
            <ShieldCheck size={16} />
            <span>
              Xử lý hoàn toàn trên thiết bị. Không tải ảnh lên máy chủ.
            </span>
          </div>
        </section>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Đóng</button>
          </div>
        )}
        <section className="results">
          <div className="section-heading">
            <div>
              <span className="step">02</span>
              <h2>Tài liệu đã scan</h2>
              <span className="count">{pages.length}</span>
            </div>
            {busy ? (
              <span className="progress" role="status">
                <LoaderCircle size={16} className="spin" />
                {progress}
              </span>
            ) : (
              <span className="subtle">
                {completed
                  ? `${completed} trang đã sẵn sàng`
                  : "Mọi trang, cùng một nơi"}
              </span>
            )}
          </div>
          {pages.length ? (
            <Preview
              onReorder={(from, to) =>
                setPages((previous) => {
                  const source = previous.findIndex((p) => p.id === from);
                  const target = previous.findIndex((p) => p.id === to);
                  if (source < 0 || target < 0 || source === target)
                    return previous;
                  const reordered = [...previous];
                  const [moved] = reordered.splice(source, 1);
                  reordered.splice(target, 0, moved);
                  return reordered;
                })
              }
              pages={pages}
              locked={locked}
              onEdit={setEditing}
              onRemove={(id) => {
                const p = pages.find((p) => p.id === id)!;
                revoke(p.preview);
                revoke(p.resultUrl);
                setPages((prev) => prev.filter((p) => p.id !== id));
              }}
              onMove={(id, d) =>
                setPages((prev) => {
                  const next = [...prev],
                    i = next.findIndex((p) => p.id === id);
                  [next[i], next[i + d]] = [next[i + d], next[i]];
                  return next;
                })
              }
              onRetry={async (id) => {
                if (running.current) return;
                running.current = true;
                setBusy(true);
                resetWorker();
                const p = pages.find((p) => p.id === id)!;
                await scan(p);
                setBusy(false);
                running.current = false;
                if (p.mode === "normal") setEditing(id);
              }}
            />
          ) : (
            <div className="empty">
              <span>
                <Files size={30} />
              </span>
              <h3>Tài liệu đẹp bắt đầu từ đây</h3>
              <p>Thêm ảnh phía trên. Bản scan của bạn sẽ xuất hiện ở đây.</p>
            </div>
          )}
          <div className="export-bar">
            <div>
              <strong>
                {pages.length
                  ? `${pages.length} trang tài liệu`
                  : "Sẵn sàng khi bạn cần"}
              </strong>
              <p>
                {pages.some((p) => p.status === "error")
                  ? "Thử lại hoặc xóa ảnh lỗi để tải tài liệu."
                  : pages.some((p) => p.status === "pending")
                    ? "Chỉnh vùng scan và xác nhận các ảnh còn lại."
                    : "Sắp xếp trang theo ý bạn, rồi tải xuống."}
              </p>
            </div>
            <div className="export-actions">
              {(["pdf", "jpg"] as const).map((format) => (
                <button
                  key={format}
                  className="primary"
                  disabled={
                    locked || !pages.length || completed !== pages.length
                  }
                  onClick={async () => {
                    setExporting(format);
                    try {
                      await exportPages(pages, format);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  {exporting === format ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <ArrowDownToLine size={18} />
                  )}{" "}
                  Tải {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="how-to">
          <span>
            <b>1</b>Thêm ảnh
          </span>
          <ArrowUpRight />
          <span>
            <b>2</b>Scan & chỉnh viền
          </span>
          <ArrowUpRight />
          <span>
            <b>3</b>Tải tài liệu
          </span>
        </div>
      </main>
      <footer>
        <span className="footer-brand">gọn scan</span>
        <span>Một chút gọn gàng cho ngày làm việc của bạn.</span>
        <span>
          Riêng tư từ thiết kế <ShieldCheck size={14} />
        </span>
      </footer>
      {current && (
        <BoundaryEditor
          key={current.id}
          page={current}
          colorMode={colorMode}
          onCancel={() => setEditing(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
