"use client";

import React, { useRef } from "react";
import clsx from "clsx";

export interface FormResizeHandleProps {
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
}

export function FormResizeHandle({
  active = false,
  onMouseDown,
  onDoubleClick,
}: FormResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.();
      }}
      onClick={(e) => e.stopPropagation()}
      title="Drag to resize column · Double-click to reset width"
      className="group/handle absolute right-0 top-0 bottom-0 z-20 flex w-2 cursor-col-resize items-center justify-end"
    >
      <div
        className={clsx(
          "h-full w-0.5 transition-colors",
          active
            ? "bg-primary-600"
            : "bg-transparent group-hover/handle:bg-primary-500/80"
        )}
      />
    </div>
  );
}

export interface FormResizableThProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  colKey: string;
  width?: number;
  resizable?: boolean;
  isResizing?: boolean;
  onResizeStart: (
    key: string,
    e: React.MouseEvent,
    el?: HTMLElement | null
  ) => void;
  onResetWidth?: (key: string) => void;
}

export function FormResizableTh({
  colKey,
  width,
  resizable = true,
  isResizing = false,
  onResizeStart,
  onResetWidth,
  className,
  style,
  children,
  ...rest
}: FormResizableThProps) {
  const thRef = useRef<HTMLTableCellElement>(null);

  return (
    <th
      ref={thRef}
      {...rest}
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: width ? `${width}px` : undefined,
        ...style,
      }}
      className={clsx("relative", isResizing && "bg-primary-50/40", className)}
    >
      {children}
      {resizable && (
        <FormResizeHandle
          active={isResizing}
          onMouseDown={(e) => onResizeStart(colKey, e, thRef.current)}
          onDoubleClick={() => onResetWidth?.(colKey)}
        />
      )}
    </th>
  );
}
