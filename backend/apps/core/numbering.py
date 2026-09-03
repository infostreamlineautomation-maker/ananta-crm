"""Shared PREFIX+YEAR+sequence document numbering (e.g. ORD-2026-0001,
QT-2026-0001), matching the pattern the legacy app already used for
quotations — generalized here so Orders gets the same scheme, and scoped per
organization so Ananta and Meewa each have their own independent sequence.

Uses a locked NumberSequence row rather than scanning
MAX(existing number): two requests calling next_number() for the same key at
the same instant used to be able to compute the same next value and then
fail on the model's unique constraint. select_for_update() serializes them —
the second request blocks until the first commits, then sees the updated
counter. The trade-off is the usual one for any sequence generator (DB SERIAL
columns included): if the surrounding save fails after next_number() already
committed its own short transaction, that number is skipped, not reused.
"""

from datetime import date

from django.db import transaction

from .models import NumberSequence


def next_number(organization, prefix: str, width: int = 4) -> str:
    year = date.today().year
    key = f"{prefix}{year}"
    with transaction.atomic():
        seq, _ = NumberSequence.objects.select_for_update().get_or_create(organization=organization, key=key)
        seq.last_value += 1
        seq.save(update_fields=["last_value"])
        return f"{key}-{str(seq.last_value).zfill(width)}"
