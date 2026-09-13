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
  minWidth = 50,
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
        "group relative select-none px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint transition-colors whitespace-nowrap",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        isDraggable && "cursor-grab active:cursor-grabbing hover:text-ink hover:bg-surface-sunken/70",
        isBeingDragged && "opacity-40 bg-primary-50",
        isDragTarget && "border-l-2 border-l-primary-600 bg-primary-50/50 ring-2 ring-primary-200/50",
        className
      )}
    >
      <div
        className={clsx(
          "inline-flex items-center gap-1.5",
          align === "center" && "justify-center w-full",
          align === "right" && "justify-end w-full",
          align === "left" && "justify-start"
        )}
      >
        <div className="truncate">{children}</div>
        {isDraggable && (
          <GripVertical className="h-3 w-3 text-ink-faint/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab ml-0.5" />
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
