"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Plus, Trash2, UploadCloud, X, Eye } from "lucide-react";
import { OrderImage } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

interface ProjectImageUploaderProps {
  orderId?: number;
  existingImages?: OrderImage[];
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  onImageUploaded?: (img: OrderImage) => void;
  onImageDeleted?: (id: number) => void;
}

export function ProjectImageUploader({
  orderId,
  existingImages = [],
  pendingFiles,
  onPendingFilesChange,
  onImageUploaded,
  onImageDeleted,
}: ProjectImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [uploadingDirect, setUploadingDirect] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Generate temporary object URLs for pending files
  const pendingPreviews = pendingFiles.map((file, idx) => ({
    file,
    url: URL.createObjectURL(file),
    index: idx,
  }));

  const handleFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList).filter((f) => f.type.startsWith("image/"));

    if (incoming.length === 0) {
      toast.error("Please upload image files only (PNG, JPG, WebP, etc.).");
      return;
    }

    if (orderId) {
      // Direct upload since project/order exists
      setUploadingDirect(true);
      try {
        for (const file of incoming) {
          const fd = new FormData();
          fd.append("order", String(orderId));
          fd.append("image", file);
          const uploaded = await apiFetch<OrderImage>("/api/order-images/", {
            method: "POST",
            body: fd,
          });
          onImageUploaded?.(uploaded);
        }
        toast.success(`${incoming.length} image${incoming.length === 1 ? "" : "s"} uploaded.`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to upload image(s).");
      } finally {
        setUploadingDirect(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } else {
      // Accumulate into pending files
      onPendingFilesChange([...pendingFiles, ...incoming]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
  };

  const deleteExistingImage = async (img: OrderImage | { id?: number; image: string }) => {
    if (!img.id) return;
    try {
      await apiFetch(`/api/order-images/${img.id}/`, { method: "DELETE" });
      toast.success("Image removed.");
      onImageDeleted?.(img.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete image.");
    }
  };

  // Combine for lightbox
  const allImages = [
    ...existingImages.map((img) => ({ id: img.id, image: img.image, caption: img.caption })),
    ...pendingPreviews.map((p) => ({ image: p.url, caption: p.file.name })),
  ];

  const totalCount = existingImages.length + pendingFiles.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone / Upload trigger */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-primary-500 bg-primary-50/60"
            : "border-border-strong hover:border-primary-400 hover:bg-surface-sunken/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-ink">
            {uploadingDirect ? "Uploading images..." : "Click or drag & drop project images"}
          </p>
          <p className="text-[11px] text-ink-faint">Supports multiple PNG, JPG, WebP, SVG files</p>
        </div>
      </div>

      {/* Thumbnails grid */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {/* Existing images */}
          {existingImages.map((img, idx) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-sunken"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image}
                alt="Project ref"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white hover:bg-white/40 cursor-pointer"
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this image?")) {
                      deleteExistingImage(img);
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/80 text-white hover:bg-rose-600 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Pending files */}
          {pendingPreviews.map((p, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-lg border-2 border-primary-300 bg-surface-sunken"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.file.name}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span className="absolute bottom-1 left-1 rounded bg-primary-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                New
              </span>
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(existingImages.length + idx);
                    setLightboxOpen(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white hover:bg-white/40 cursor-pointer"
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePendingFile(idx);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/80 text-white hover:bg-rose-600 cursor-pointer"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <ImageLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={allImages}
        initialIndex={lightboxIndex}
        onDelete={deleteExistingImage}
      />
    </div>
  );
}
