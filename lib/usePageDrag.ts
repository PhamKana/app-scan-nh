"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Pointer capture keeps mouse and touch drags active outside the handle. */
export function usePageDrag(
  locked: boolean,
  onReorder: (from: string, to: string) => void,
) {
  const [drag, setDrag] = useState<{
    id: string;
    target: string | null;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
    target: string | null;
  } | null>(null);
  const frame = useRef(0);

  function cancel() {
    cancelAnimationFrame(frame.current);
    active.current = null;
    setDrag(null);
  }

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  useEffect(() => {
    if (locked) cancel();
  }, [locked]);

  function locate() {
    const current = active.current;
    if (!current?.moved) return;
    const card = document
      .elementFromPoint(current.x, current.y)
      ?.closest<HTMLElement>("[data-page-id]");
    const target = card?.dataset.pageId || null;
    if (target !== current.target) {
      current.target = target;
      setDrag({ id: current.id, target });
    }
  }
  function scroll() {
    const current = active.current;
    if (!current) return;
    if (current.moved) {
      const edge = 70;
      const amount =
        current.y < edge ? -12 : current.y > window.innerHeight - edge ? 12 : 0;
      if (amount) window.scrollBy(0, amount);
      locate();
    }
    frame.current = requestAnimationFrame(scroll);
  }

  return {
    drag,
    announcement,
    handlers: (id: string) => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (locked || !event.isPrimary || event.button !== 0 || active.current)
          return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = {
          id,
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          target: null,
        };
        frame.current = requestAnimationFrame(scroll);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const current = active.current;
        if (!current || current.pointer !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        if (
          !current.moved &&
          Math.hypot(current.x - current.startX, current.y - current.startY) >=
            6
        ) {
          current.moved = true;
          setDrag({ id, target: null });
        }
        locate();
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const current = active.current;
        if (!current || current.pointer !== event.pointerId) return;
        current.x = event.clientX;
        current.y = event.clientY;
        locate();
        if (
          !locked &&
          current.moved &&
          current.target &&
          current.target !== current.id
        ) {
          onReorder(current.id, current.target);
          setAnnouncement("Đã cập nhật thứ tự trang. PDF sẽ dùng thứ tự mới.");
        }
        cancel();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel,
    }),
  };
}
