import { useEffect, useRef, useState } from 'react';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Shared year-selector state for pages that slice `events` by `reporting_year`.
 * Starts on the current calendar year, then auto-corrects once — on the first
 * load that actually has event data — to the most recent past-or-current year
 * that has events, if the calendar year itself has none. Without this, the
 * page silently renders empty every time the calendar rolls over ahead of
 * this year's reporting data, even though older real data exists.
 *
 * Only considers years <= the current calendar year so it never lands on a
 * stray future-dated fixture (e.g. test data seeded under year 2097).
 */
export function useReportingYear(events: any[]) {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const autoSelected = useRef(false);

  useEffect(() => {
    if (autoSelected.current || events.length === 0) return;
    autoSelected.current = true;

    const hasCurrentYear = events.some((e) => e.reporting_year === String(CURRENT_YEAR));
    if (!hasCurrentYear) {
      const pastOrPresentYears = events
        .map((e) => e.reporting_year)
        .filter((y) => y && Number(y) <= CURRENT_YEAR)
        .sort((a, b) => Number(b) - Number(a));
      if (pastOrPresentYears.length > 0) setSelectedYear(pastOrPresentYears[0]);
    }
  }, [events]);

  const availableYears = Array.from(new Set([
    String(CURRENT_YEAR),
    ...events.map((e: any) => e.reporting_year).filter(Boolean),
  ])).sort((a, b) => Number(b) - Number(a));

  return { selectedYear, setSelectedYear, availableYears };
}
