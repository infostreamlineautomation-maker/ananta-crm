import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { ExchangeRate } from "./types";

let cachedRates: ExchangeRate[] | null = null;
let lastFetchTime = 0;

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const now = Date.now();
  if (cachedRates && now - lastFetchTime < 60000) {
    return cachedRates;
  }
  try {
    const data = await apiFetch<ExchangeRate[]>("/api/exchange-rates/");
    cachedRates = data;
    lastFetchTime = now;
    return data;
  } catch {
    return cachedRates || [];
  }
}

export function computeConversionFactor(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[],
  baseCurrency = "INR",
): number {
  const from = (fromCurrency || baseCurrency).toUpperCase();
  const to = (toCurrency || baseCurrency).toUpperCase();

  if (from === to) return 1.0;

  // Find rates against base
  const fromObj = rates.find((r) => r.source_currency === from);
  const toObj = rates.find((r) => r.source_currency === to);

  const rateFromBase = from === baseCurrency ? 1.0 : fromObj ? parseFloat(fromObj.rate) || 1.0 : 1.0;
  const rateToBase = to === baseCurrency ? 1.0 : toObj ? parseFloat(toObj.rate) || 1.0 : 1.0;

  if (rateToBase <= 0) return 1.0;
  return rateFromBase / rateToBase;
}

export function useForex() {
  const [rates, setRates] = useState<ExchangeRate[]>(cachedRates || []);
  const [loading, setLoading] = useState(!cachedRates);

  useEffect(() => {
    fetchExchangeRates().then((data) => {
      setRates(data);
      setLoading(false);
    });
  }, []);

  const convert = (amount: number | string, fromCurrency: string, toCurrency: string, baseCurrency = "INR") => {
    const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
    const factor = computeConversionFactor(fromCurrency, toCurrency, rates, baseCurrency);
    return Math.round(num * factor * 100) / 100;
  };

  const getRate = (fromCurrency: string, toCurrency: string, baseCurrency = "INR") => {
    return computeConversionFactor(fromCurrency, toCurrency, rates, baseCurrency);
  };

  return { rates, loading, convert, getRate };
}
