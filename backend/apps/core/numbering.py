"""Document numbering in the format PREFIX/001-YY (e.g. AG/001-26, QT/001-26).
Scoped per organization and document type using NumberSequence with row-level locks.
"""

from datetime import date
from django.db import transaction
from .models import NumberSequence


def next_number(organization, prefix: str = None, doc_type: str = "order", width: int = 3) -> str:
    """Generate next document number in format PREFIX/001-YY (e.g. AG/001-26)."""
    year_2digit = date.today().strftime("%y")

    clean_prefix = (prefix or getattr(organization, f"{doc_type}_prefix", None) or "AG/").strip()
    if clean_prefix.endswith("-"):
        clean_prefix = clean_prefix[:-1] + "/"
    elif not clean_prefix.endswith("/"):
        clean_prefix = f"{clean_prefix}/"

    key = f"{doc_type}:{clean_prefix}{year_2digit}"
    with transaction.atomic():
        seq, _ = NumberSequence.objects.select_for_update().get_or_create(
            organization=organization, key=key
        )
        seq.last_value += 1
        seq.save(update_fields=["last_value"])
        seq_str = str(seq.last_value).zfill(width)
        return f"{clean_prefix}{seq_str}-{year_2digit}"
