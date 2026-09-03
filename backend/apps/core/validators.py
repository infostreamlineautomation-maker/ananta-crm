"""Content-sniffing upload validation. The legacy app only checked file
extensions (never actual content) and had no size cap outside one module —
this closes both gaps for non-image uploads. Image uploads (order/quotation
item photos, logos) use Django's ImageField instead, which already runs the
file through Pillow's Image.verify() and rejects anything that isn't a real
raster image — including SVG, which Pillow doesn't parse, closing the
SVG-script XSS risk the audit flagged."""

from rest_framework import serializers

MAGIC_BYTES = {
    "pdf": [b"%PDF"],
    "xlsx": [b"PK\x03\x04"],  # zip container; good enough at this layer
    "xls": [b"\xd0\xcf\x11\xe0"],  # OLE compound file
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
}

MAX_UPLOAD_MB = 10


def validate_file_upload(uploaded_file, allowed_extensions):
    ext = uploaded_file.name.rsplit(".", 1)[-1].lower() if "." in uploaded_file.name else ""
    if ext not in allowed_extensions:
        raise serializers.ValidationError(f"Unsupported file type .{ext}. Allowed: {', '.join(allowed_extensions)}")

    if uploaded_file.size > MAX_UPLOAD_MB * 1024 * 1024:
        raise serializers.ValidationError(f"File is larger than {MAX_UPLOAD_MB}MB.")

    signatures = MAGIC_BYTES.get(ext)
    if signatures:
        head = uploaded_file.read(8)
        uploaded_file.seek(0)
        if not any(head.startswith(sig) for sig in signatures):
            raise serializers.ValidationError("File content doesn't match its extension.")
    return uploaded_file
