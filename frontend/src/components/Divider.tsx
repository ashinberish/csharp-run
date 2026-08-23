import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DividerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (editorFraction: number) => void;
}

export function Divider({ containerRef, onResize }: DividerProps) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    draggingRef.current = true;

    function handleMove(ev: PointerEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = (ev.clientX - rect.left) / rect.width;
      onResize(Math.min(0.85, Math.max(0.15, fraction)));
    }

    function handleUp() {
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      className={cn(
        "w-[5px] shrink-0 cursor-col-resize border-x border-border bg-card transition-colors",
        dragging && "bg-divider-hover",
      )}
      onPointerDown={handlePointerDown}
    />
  );
}
