"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { OrderImage } from "@/lib/types";

interface ImageLightboxModalProps {
  open: boolean;
  onClose: () => void;
  images: (OrderImage | { id?: number; image: string; caption?: string })[];
  initialIndex?: number;
  onDelete?: (image: OrderImage | { id?: number; image: string }) => Promise<void>;
}

export function ImageLightboxModal({
  open,
  onClose,
  images,
  initialIndex = 0,
  onDelete,
}: ImageLightboxModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
    setZoomed(false);
  }, [initialIndex, open, images.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, currentIndex, images.length, onClose]);

  if (!open || !mounted || images.length === 0) return null;

  const currentImg = images[currentIndex] || images[0];

  const handlePrev = () => {
    setZoomed(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setZoomed(false);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = async () => {
    if (!onDelete || !currentImg) return;
    if (confirm("Are you sure you want to delete this image?")) {
      setDeleting(true);
      try {
        await onDelete(currentImg);
        if (currentIndex >= images.length - 1) {
          setCurrentIndex(Math.max(0, images.length - 2));
        }
      } finally {
        setDeleting(false);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/90 backdrop-blur-md transition-all">
      {/* Top action bar */}
      <div className="flex h-14 items-center justify-between px-6 text-white/90">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-white/80">
            Image {currentIndex + 1} of {images.length}
          </span>
          {currentImg.caption && (
            <span className="max-w-md truncate text-xs text-white/60">
              — {currentImg.caption}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoomed(!zoomed)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer transition-colors"
            title={zoomed ? "Zoom Out" : "Zoom In"}
          >
            {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </button>
          <a
            href={currentImg.image}
            target="_blank"
            rel="noreferrer"
            download
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer transition-colors"
            title="Open in new tab / download"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {onDelete && currentImg.id && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 cursor-pointer transition-colors"
              title="Delete image"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImg.image}
            alt={currentImg.caption || `Project image ${currentIndex + 1}`}
            className={`transition-all duration-200 object-contain rounded-lg shadow-2xl ${
              zoomed ? "max-h-none max-w-none cursor-zoom-out" : "max-h-[78vh] max-w-[85vw] cursor-zoom-in"
            }`}
            onClick={() => setZoomed(!zoomed)}
          />
        </div>

        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex h-20 items-center justify-center gap-2.5 overflow-x-auto border-t border-white/10 bg-black/40 px-6 py-2">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setZoomed(false);
              }}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all cursor-pointer ${
                idx === currentIndex
                  ? "border-primary-400 scale-105 shadow-md shadow-primary-500/20"
                  : "border-transparent opacity-50 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image}
                alt="thumb"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
