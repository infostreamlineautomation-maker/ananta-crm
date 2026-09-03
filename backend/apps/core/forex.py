import json
import logging
import urllib.request
from decimal import Decimal
from django.utils import timezone
from .models import ExchangeRate

logger = logging.getLogger(__name__)

# Standard offline fallback rates relative to USD
FALLBACK_USD_RATES = {
    "USD": 1.0,
    "INR": 83.50,
    "AED": 3.6725,
    "EUR": 0.92,
    "GBP": 0.79,
    "SAR": 3.75,
    "QAR": 3.64,
    "KWD": 0.31,
    "OMR": 0.385,
    "BHD": 0.376,
    "CAD": 1.36,
    "AUD": 1.52,
    "SGD": 1.34,
    "JPY": 155.0,
    "CNY": 7.23,
}

TRACKED_CURRENCIES = [
    ("INR", "Indian Rupee", "₹"),
    ("AED", "UAE Dirham", "AED"),
    ("USD", "US Dollar", "$"),
    ("EUR", "Euro", "€"),
    ("GBP", "British Pound", "£"),
    ("SAR", "Saudi Riyal", "SAR"),
    ("QAR", "Qatari Riyal", "QAR"),
    ("KWD", "Kuwaiti Dinar", "KWD"),
    ("OMR", "Omani Rial", "OMR"),
    ("BHD", "Bahraini Dinar", "BHD"),
    ("CAD", "Canadian Dollar", "CA$"),
    ("AUD", "Australian Dollar", "AU$"),
    ("SGD", "Singapore Dollar", "SG$"),
]


def fetch_live_rates(base_currency: str = "USD") -> dict:
    """Fetches real-time exchange rates from open.er-api.com (free, high availability, no API key).
    Falls back to mathematical cross-rate calculated from FALLBACK_USD_RATES if network fails."""
    url = f"https://open.er-api.com/v6/latest/{base_currency.upper()}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AnantaCRM/1.0 (ForexService)"},
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                if data.get("result") == "success" and "rates" in data:
                    return data["rates"]
    except Exception as e:
        logger.warning(f"Could not fetch live forex rates from {url}: {e}. Using offline fallback rates.")

    # Offline cross-rate fallback calculation:
    base_usd = FALLBACK_USD_RATES.get(base_currency.upper(), 1.0)
    rates = {}
    for curr, usd_val in FALLBACK_USD_RATES.items():
        # 1 base_currency in curr = usd_val / base_usd
        rates[curr] = usd_val / base_usd
    return rates


def sync_exchange_rates(organization=None) -> list:
    """Syncs or initializes exchange rates against the organization's base currency
    (or global default if no organization). Preserves manual overrides."""
    base_curr = organization.default_currency_code.upper() if organization else "INR"
    live_rates = fetch_live_rates(base_curr)

    synced_records = []
    for code, name, symbol in TRACKED_CURRENCIES:
        if code == base_curr:
            continue

        # Rate of 1 `code` into `base_curr`:
        # Since `live_rates` is keyed by `base_curr` (e.g. base=INR -> rates[AED]=0.0438),
        # 1 AED in INR is 1 / live_rates[AED]
        rate_of_base = live_rates.get(code)
        if rate_of_base and rate_of_base > 0:
            market_rate_val = Decimal(str(round(1.0 / rate_of_base, 6)))
        else:
            market_rate_val = Decimal("1.0")

        obj, created = ExchangeRate.objects.get_or_create(
            organization=organization,
            source_currency=code,
            target_currency=base_curr,
            defaults={
                "rate": market_rate_val,
                "market_rate": market_rate_val,
                "is_manual_override": False,
            },
        )

        if not created:
            obj.market_rate = market_rate_val
            if not obj.is_manual_override:
                obj.rate = market_rate_val
            obj.save(update_fields=["market_rate", "rate", "last_synced_at"])

        synced_records.append(obj)

    return synced_records


def get_exchange_rate(source_currency: str, target_currency: str, organization=None) -> Decimal:
    """Returns the effective exchange rate to convert 1 `source_currency` to `target_currency`.
    Example: get_exchange_rate('AED', 'INR') -> Decimal('22.80')"""
    source = (source_currency or "INR").upper()
    target = (target_currency or (organization.default_currency_code if organization else "INR")).upper()

    if source == target:
        return Decimal("1.0")

    # 1. Direct pair in DB:
    rate_obj = ExchangeRate.objects.filter(
        organization=organization,
        source_currency=source,
        target_currency=target,
    ).first()

    if rate_obj:
        return rate_obj.rate

    # 2. Inverse pair in DB:
    inv_rate_obj = ExchangeRate.objects.filter(
        organization=organization,
        source_currency=target,
        target_currency=source,
    ).first()

    if inv_rate_obj and inv_rate_obj.rate > 0:
        return Decimal(str(round(1.0 / float(inv_rate_obj.rate), 6)))

    # 3. Fallback calculation:
    rates = fetch_live_rates(target)
    rate_val = rates.get(source)
    if rate_val and rate_val > 0:
        return Decimal(str(round(1.0 / rate_val, 6)))

    return Decimal("1.0")
