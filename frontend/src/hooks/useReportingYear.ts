import { useEffect, useRef, useState } from 'react';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Shared year-selector state for pages that slice their data by `reporting_year`.
 * Starts on the current calendar year, then auto-corrects once — on the first
 * load that actually has data — to the most recent past-or-current year that
 * has data, if the calendar year itself has none. Without this, the page
 * silently renders empty every time the calendar rolls over ahead of this
 * year's reporting data, even though older real data exists.
 *
 * `years` should list the reporting years that actually have the data this
 * page renders (e.g. event years for Dashboard/SDG/Reporting, governance-row
 * years for Governance) — not just any year that happens to exist elsewhere,
 * or the default can land on a year with nothing to show.
 *
 * Only considers years <= the current calendar year so it never lands on a
 * stray future-dated fixture (e.g. test data seeded under year 2097).
 */
export function useReportingYear(years: (string | null | undefined)[]) {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const autoSelected = useRef(false);

  useEffect(() => {
    if (autoSelected.current || years.length === 0) return;
    autoSelected.current = true;

    const hasCurrentYear = years.includes(String(CURRENT_YEAR));
    if (!hasCurrentYear) {
      const pastOrPresentYears = years
        .filter((y): y is string => !!y && Number(y) <= CURRENT_YEAR)
        .sort((a, b) => Number(b) - Number(a));
      if (pastOrPresentYears.length > 0) setSelectedYear(pastOrPresentYears[0]);
    }
  }, [years]);

  const availableYears = Array.from(new Set([
    String(CURRENT_YEAR),
    ...years.filter(Boolean) as string[],
  ])).sort((a, b) => Number(b) - Number(a));

  return { selectedYear, setSelectedYear, availableYears };
}
