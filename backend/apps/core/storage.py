import os
from cloudinary_storage.storage import MediaCloudinaryStorage


class DynamicCloudinaryStorage(MediaCloudinaryStorage):
    """Smart Cloudinary storage that automatically assigns the correct Cloudinary resource_type:
    - 'raw' for documents, spreadsheets, PDFs, archives, and data files (pdf, xlsx, xls, csv, doc, docx, zip, etc.)
    - 'video' for video formats (mp4, mov, avi, webm, mkv, m4v)
    - 'image' for all images, unknown image formats, and extensionless Cloudinary image public IDs.
    """

    RAW_EXTENSIONS = {
        ".pdf",
        ".xlsx",
        ".xls",
        ".csv",
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
        ".txt",
        ".json",
        ".xml",
    }
    VIDEO_EXTENSIONS = {
        ".mp4",
        ".mov",
        ".avi",
        ".webm",
        ".mkv",
        ".m4v",
    }
    IMAGE_EXTENSIONS = {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".gif",
        ".bmp",
        ".ico",
        ".avif",
        ".tiff",
    }

    def _get_resource_type(self, name):
        if not name:
            return "image"
        ext = os.path.splitext(str(name))[1].lower()
        if ext in self.RAW_EXTENSIONS:
            return "raw"
        elif ext in self.VIDEO_EXTENSIONS:
            return "video"
        # If ext is in IMAGE_EXTENSIONS or ext is empty (which Cloudinary does for image public_ids), return "image"
        return "image"
