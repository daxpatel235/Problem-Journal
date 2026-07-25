import { useEffect, useRef } from "react";

interface ResizableDividerProps {
  onDrag: (deltaX: number) => void;
  onDragEnd?: () => void;
}

export function ResizableDivider({ onDrag, onDragEnd }: ResizableDividerProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  function handleMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    }
    function handleMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onDragEnd?.();
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onDrag, onDragEnd]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative w-px shrink-0 cursor-col-resize bg-border"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/40" />
    </div>
  );
}
