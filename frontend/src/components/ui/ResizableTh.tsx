"use client";

import { useRef } from "react";
import clsx from "clsx";
import { GripVertical } from "lucide-react";
import { useTableGrid } from "@/lib/useTableGrid";

type TableGridInstance = ReturnType<typeof useTableGrid>;

interface ResizableThProps {
  columnKey: string;
  grid?: TableGridInstance;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  isDraggable?: boolean;
  isResizable?: boolean;
  draggedKey?: string | null;
  dragOverKey?: string | null;
  onDragStart?: (key: string) => void;
  onDragOver?: (key: string) => void;
  onDragLeave?: () => void;
  onDrop?: (sourceKey: string, targetKey: string) => void;
  onDragEnd?: () => void;
  onResize?: (key: string, startX: number, startWidth: number) => void;
  className?: string;
  children: React.ReactNode;
}

export function ResizableTh({
  columnKey,
  grid,
  width: propWidth,
  minWidth = 65,
  align = "left",
  isDraggable = true,
  isResizable = true,
  draggedKey: propDraggedKey,
  dragOverKey: propDragOverKey,
  onDragStart: propOnDragStart,
  onDragOver: propOnDragOver,
  onDragLeave: propOnDragLeave,
  onDrop: propOnDrop,
  onDragEnd: propOnDragEnd,
  onResize: propOnResize,
  className,
  children,
}: ResizableThProps) {
  const thRef = useRef<HTMLTableCellElement>(null);

  const effectiveWidth = propWidth ?? (grid?.columnWidths ? grid.columnWidths[columnKey] : undefined);
  const effectiveDraggedKey = propDraggedKey ?? grid?.draggedColKey;
  const effectiveDragOverKey = propDragOverKey ?? grid?.dragOverColKey;
  const effectiveOnDragStart = propOnDragStart ?? grid?.setDraggedColKey;
  const effectiveOnDragOver = propOnDragOver ?? grid?.setDragOverColKey;
  const effectiveOnDragLeave = propOnDragLeave ?? (() => grid?.setDragOverColKey(null));
  const effectiveOnDrop = propOnDrop ?? grid?.reorderColumns;
  const effectiveOnDragEnd = propOnDragEnd ?? (() => {
    grid?.setDraggedColKey(null);
    grid?.setDragOverColKey(null);
  });
  const effectiveOnResize = propOnResize ?? grid?.startResizing;

  const isBeingDragged = effectiveDraggedKey === columnKey;
  const isDragTarget = effectiveDragOverKey === columnKey && effectiveDraggedKey !== columnKey;

  // Dynamically adapt header font size and padding based on column width
  const isVeryNarrow = effectiveWidth ? effectiveWidth < 80 : false;
  const isNarrow = effectiveWidth ? effectiveWidth < 105 : false;
  const fontAndPaddingClass = isVeryNarrow
    ? "text-[9.5px] tracking-normal px-2 py-2"
    : isNarrow
    ? "text-[10px] tracking-normal px-2.5 py-2.5"
    : "text-[11px] tracking-wider px-3.5 py-2.5";

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!thRef.current || !effectiveOnResize) return;
    const startX = e.clientX;
    const startWidth = thRef.current.offsetWidth || effectiveWidth || 120;
    effectiveOnResize(columnKey, startX, startWidth);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!isDraggable) return;
    e.dataTransfer.setData("text/plain", columnKey);
    e.dataTransfer.effectAllowed = "move";
    effectiveOnDragStart?.(columnKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDraggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    effectiveOnDragOver?.(columnKey);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isDraggable) return;
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData("text/plain");
    if (sourceKey && sourceKey !== columnKey) {
      effectiveOnDrop?.(sourceKey, columnKey);
    }
    effectiveOnDragEnd?.();
  };

  return (
    <th
      ref={thRef}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={effectiveOnDragLeave}
      onDrop={handleDrop}
      onDragEnd={effectiveOnDragEnd}
      style={{
        width: effectiveWidth ? `${effectiveWidth}px` : undefined,
        minWidth: effectiveWidth ? `${effectiveWidth}px` : `${minWidth}px`,
        maxWidth: effectiveWidth ? `${effectiveWidth}px` : undefined,
      }}
      className={clsx(
        "group sticky top-0 z-20 select-none font-bold uppercase text-ink-faint transition-colors whitespace-nowrap overflow-hidden bg-surface-sunken border-b border-border shadow-2xs",
        fontAndPaddingClass,
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        isDraggable && "cursor-grab active:cursor-grabbing hover:text-ink hover:bg-surface-sunken/90",
        isBeingDragged && "opacity-40 bg-primary-50",
        isDragTarget && "border-l-2 border-l-primary-600 bg-primary-50/50 ring-2 ring-primary-200/50",
        className
      )}
    >
      <div
        className={clsx(
          "flex items-center gap-1 w-full min-w-0 max-w-full overflow-hidden",
          align === "center" && "justify-center text-center",
          align === "right" && "justify-end text-right",
          align === "left" && "justify-start text-left"
        )}
      >
        <div className="min-w-0 max-w-full truncate">{children}</div>
        {isDraggable && (
          <GripVertical className="h-3 w-3 text-ink-faint/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab ml-0.5" />
        )}
      </div>

      {/* Resize Handle */}
      {isResizable && (
        <div
          onMouseDown={handleMouseDownResize}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary-500/40 active:bg-primary-600 transition-colors z-10"
          title="Drag to resize column width"
        />
      )}
    </th>
  );
}
