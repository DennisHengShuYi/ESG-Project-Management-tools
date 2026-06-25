import { test, expect } from '@playwright/test';
import { api } from '../utils/api';
import { metricValue, fillEditField, editFieldInput, startEdit, saveEdit } from '../utils/editable-module';

let eventId: string;

test.beforeAll(async () => {
  const created = await api.createEvent({
    event_name: `[E2E] EventDetail Calc Test ${Date.now()}`,
    event_status: 'Active',
  });
  eventId = created.id;
});

test.afterAll(async () => {
  if (eventId) await api.deleteEvent(eventId);
});

test.beforeEach(async ({ page }) => {
  await page.goto(`/events/${eventId}`);
});

const gotoTab = async (page: any, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).click();
};

test.describe('Green Ops calculations', () => {
  test('renewable_energy_pct = renewable_energy_mwh / total_energy_mwh * 100', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    await startEdit(page);
    await fillEditField(page, 'Energy Consumption', '1000');
    await fillEditField(page, 'Renewable Energy', '250');
    await saveEdit(page);

    // .toContainText, not .toHaveText: this field is readOnly, and EditableModule
    // nests an "auto" badge inside .metric-value (e.g. "25.0%auto"), so an exact
    // match would fail even when the calculation itself is correct.
    await expect(metricValue(page, 'Renewable Energy Share')).toContainText('25.0%');
    const detail = await api.getEventDetail(eventId);
    expect(detail.renewable_energy_pct).toBe(25);
  });

  test('zero total_energy_mwh guards against divide-by-zero (renders 0%, not NaN/Infinity)', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    await startEdit(page);
    await fillEditField(page, 'Energy Consumption', '0');
    await fillEditField(page, 'Renewable Energy', '0');
    await saveEdit(page);

    await expect(metricValue(page, 'Renewable Energy Share')).toContainText('0.0%');
    const detail = await api.getEventDetail(eventId);
    expect(detail.renewable_energy_pct).toBe(0);
  });

  test('waste_diversion_pct = recycled / (hazardous + nonhazardous) * 100', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    await startEdit(page);
    await fillEditField(page, 'Hazardous Waste', '200');
    await fillEditField(page, 'Non-Hazardous Waste', '800');
    await fillEditField(page, 'Waste Diverted (recycled/composted)', '300');
    await saveEdit(page);

    // (300/1000kg = 0.3t diverted) / (200+800)/1000 = 1t total -> 30%
    await expect(metricValue(page, 'Waste Diversion Rate')).toContainText('30.0%');
    const detail = await api.getEventDetail(eventId);
    expect(detail.waste_diverted_pct).toBe(30);
  });

  test('very large energy value persists and renders with comma formatting, no crash', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    await startEdit(page);
    await fillEditField(page, 'Energy Consumption', '123456789');
    await fillEditField(page, 'Renewable Energy', '0');
    await saveEdit(page);

    await expect(metricValue(page, 'Energy Consumption')).toHaveText('123,456,789 MWh');
    const detail = await api.getEventDetail(eventId);
    expect(detail.total_energy_mwh).toBe(123456789);
  });

  test('clearing a number field saves as 0, not NaN or an error', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    await startEdit(page);
    await fillEditField(page, 'Water Consumption', '500');
    await saveEdit(page);
    await expect(metricValue(page, 'Water Consumption')).toHaveText('500 m³');

    await startEdit(page);
    await editFieldInput(page, 'Water Consumption').fill('');
    await saveEdit(page);

    await expect(metricValue(page, 'Water Consumption')).toHaveText('0 m³');
    const detail = await api.getEventDetail(eventId);
    expect(detail.total_water_m3).toBe(0);
  });
});

test.describe('Health & Safety calculations', () => {
  test('LTIR = lti_count * 200000 / total_hours_worked', async ({ page }) => {
    await gotoTab(page, 'Health, Safety & Labour');
    await startEdit(page);
    await fillEditField(page, 'Lost Time Injuries (LTI)', '2');
    await fillEditField(page, 'Total Hours Worked', '100000');
    await saveEdit(page);

    await expect(metricValue(page, 'LTIR (auto-calculated)')).toContainText('4.0000');
    const detail = await api.getEventDetail(eventId);
    expect(detail.ltir).toBe(4);
  });

  test('zero hours worked guards against divide-by-zero', async ({ page }) => {
    await gotoTab(page, 'Health, Safety & Labour');
    await startEdit(page);
    await fillEditField(page, 'Lost Time Injuries (LTI)', '3');
    await fillEditField(page, 'Total Hours Worked', '0');
    await saveEdit(page);

    await expect(metricValue(page, 'LTIR (auto-calculated)')).toContainText('0.0000');
  });

  test('contractor_pct = staff_contractor_count / total_headcount * 100', async ({ page }) => {
    await gotoTab(page, 'Health, Safety & Labour');
    await startEdit(page);
    await fillEditField(page, 'Contract & Temp Staff Count', '30');
    await fillEditField(page, 'Total Headcount (all staff)', '100');
    await saveEdit(page);

    await expect(metricValue(page, 'Contract & Temp Ratio')).toContainText('30.0%');
    const detail = await api.getEventDetail(eventId);
    expect(detail.contractor_pct).toBe(30);
  });

  test('EDGE CASE: explicit total_headcount=0 is silently overridden by a fallback derived from stale view data', async ({ page }) => {
    // backend/src/server.js health-safety route: `Number(flat.total_headcount) || (permanent + contract)`.
    // `0 || X` evaluates to X in JS, so an explicit 0 can never survive if permanent+contract is nonzero.
    // Worse: `permanent` here isn't freshly entered — EventDetail.tsx's handleModuleSave does
    // `merged = {...event, ...updatedFields}`, and `event.staff_permanent_count` is a VIEW-DERIVED
    // value (`greatest(0, total_headcount - contract_temp_count)` in events_flat) carried over from
    // whatever the PREVIOUS save left behind, so the exact fallback number depends on prior test/edit
    // history rather than anything entered in this save. Asserting the qualitative finding (the
    // explicit 0 never survives) rather than predicting the exact compounded number.
    await gotoTab(page, 'Health, Safety & Labour');
    await startEdit(page);
    await fillEditField(page, 'Contract & Temp Staff Count', '40');
    await fillEditField(page, 'Total Headcount (all staff)', '0');
    await saveEdit(page);

    const detail = await api.getEventDetail(eventId);
    // NOT 0, despite the user explicitly entering 0 — overridden by (carried-over permanent) + 40.
    expect(detail.total_headcount).not.toBe(0);
    expect(detail.total_headcount).toBeGreaterThanOrEqual(40);
  });
});

test.describe('Procurement calculations', () => {
  test('local_supplier_spend_pct = local_supplier_spend_rm / procurement_total_rm * 100', async ({ page }) => {
    await gotoTab(page, 'Procurement & Community');
    await startEdit(page);
    await fillEditField(page, 'Total Procurement Spend', '380000');
    await fillEditField(page, 'Local Supplier Spend', '220000');
    await saveEdit(page);

    await expect(metricValue(page, 'Local Supplier Spend % (auto)')).toContainText('57.9%');
    const detail = await api.getEventDetail(eventId);
    expect(detail.local_supplier_spend_pct).toBeCloseTo(57.89, 1);
  });

  test('zero procurement total guards against divide-by-zero', async ({ page }) => {
    await gotoTab(page, 'Procurement & Community');
    await startEdit(page);
    await fillEditField(page, 'Total Procurement Spend', '0');
    await fillEditField(page, 'Local Supplier Spend', '0');
    await saveEdit(page);

    await expect(metricValue(page, 'Local Supplier Spend % (auto)')).toContainText('0.0%');
  });
});

test.describe('Financial calculations', () => {
  test('budget=1000, actual=1200 -> matches the ACTUAL app formula, not a naive "-20% variance" assumption', async ({ page }) => {
    // This is the exact example from the original test request. The app's
    // "_budget_var" field is variance (RM) + UTILISATION% (actual/estimated),
    // not a variance percentage (variance/estimated). Documented, not fixed.
    await gotoTab(page, 'Financial');
    await startEdit(page);
    await fillEditField(page, 'Estimated Budget', '1000');
    await fillEditField(page, 'Actual Cost', '1200');
    await saveEdit(page);

    const variance = metricValue(page, 'Budget Variance & Utilisation');
    await expect(variance).toContainText('RM -200');
    await expect(variance).toContainText('120.0% utilised'); // NOT "-20%"
    const detail = await api.getEventDetail(eventId);
    expect(detail.budget_estimated).toBe(1000);
    expect(detail.budget_actual).toBe(1200);
  });

  test('net profit/loss & ROI from revenue and budget actuals', async ({ page }) => {
    await gotoTab(page, 'Financial');
    await startEdit(page);
    await fillEditField(page, 'Actual Cost', '1000');
    await fillEditField(page, 'Actual Revenue', '1500');
    await saveEdit(page);

    const netProfit = metricValue(page, 'Net Profit / Loss & ROI');
    await expect(netProfit).toContainText('RM 500');
    await expect(netProfit).toContainText('50.0% ROI');
  });

  test('negative actual cost is accepted without crashing (no business-rule validation)', async ({ page }) => {
    await gotoTab(page, 'Financial');
    await startEdit(page);
    await fillEditField(page, 'Estimated Budget', '1000');
    await fillEditField(page, 'Actual Cost', '-500');
    await saveEdit(page);

    const variance = metricValue(page, 'Budget Variance & Utilisation');
    await expect(variance).toContainText('RM 1,500'); // 1000 - (-500)
    await expect(variance).toContainText('-50.0% utilised');
    const detail = await api.getEventDetail(eventId);
    expect(detail.budget_actual).toBe(-500);
  });

  test('zero estimated budget guards against divide-by-zero in utilisation %', async ({ page }) => {
    await gotoTab(page, 'Financial');
    await startEdit(page);
    await fillEditField(page, 'Estimated Budget', '0');
    await fillEditField(page, 'Actual Cost', '500');
    await saveEdit(page);

    await expect(metricValue(page, 'Budget Variance & Utilisation')).toContainText('0% utilised');
  });
});

test.describe('Timeline calculations', () => {
  test('on_time_delivery_pct = tasks_on_time / tasks_total * 100', async ({ page }) => {
    await gotoTab(page, 'Timeline & Team');
    await startEdit(page);
    await fillEditField(page, 'Total Tasks', '20');
    await fillEditField(page, 'Tasks Completed On Time', '16');
    await saveEdit(page);

    await expect(metricValue(page, 'On-Time Delivery Rate')).toContainText('80.0%');
  });

  test('BUG: editing "Actual End Date" via Save does not persist the typed value', async ({ page }) => {
    // backend/src/server.js:578 (`/api/events/:id/timeline` route) sets
    // `actual_end_date: flat.event_end_date || null` — it reads the wrong
    // key. The UI field is bound to `timeline_actual_end_date`, which this
    // route ignores entirely. Compare with the CSV bulk-update route, which
    // correctly does `flat.timeline_actual_end_date ?? flat.event_end_date`.
    await gotoTab(page, 'Timeline & Team');
    await startEdit(page);
    await fillEditField(page, 'Project Start Date', '2026-01-01');
    await fillEditField(page, 'Planned End Date', '2026-06-01');
    await fillEditField(page, 'Actual End Date', '2026-06-15');
    await saveEdit(page);

    const detail = await api.getEventDetail(eventId);
    expect(detail.project_start_date).toBe('2026-01-01'); // this key DOES map correctly
    expect(detail.project_end_planned).toBe('2026-06-01'); // this key DOES map correctly
    expect(detail.timeline_actual_end_date).not.toBe('2026-06-15'); // BUG: silently dropped
  });
});

test.describe('Attendance calculations', () => {
  test('attendance_rate = actual / expected * 100', async ({ page }) => {
    await gotoTab(page, 'Attendance');
    await startEdit(page);
    await fillEditField(page, 'Expected Attendance', '200');
    await fillEditField(page, 'Actual Attendance', '180');
    await saveEdit(page);

    await expect(metricValue(page, 'Attendance Rate')).toContainText('90.0%');
  });

  test('zero expected attendance guards against divide-by-zero', async ({ page }) => {
    await gotoTab(page, 'Attendance');
    await startEdit(page);
    await fillEditField(page, 'Expected Attendance', '0');
    await fillEditField(page, 'Actual Attendance', '0');
    await saveEdit(page);

    await expect(metricValue(page, 'Attendance Rate')).toContainText('—');
  });
});

test.describe('CSV download/upload round trip', () => {
  test('downloading produces a CSV with the current values', async ({ page }) => {
    await gotoTab(page, 'Green Ops');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/_metrics\.csv$/);
  });

  test('REGRESSION: uploading a non-ISO date format (e.g. 6/25/2026) parses to the correct calendar day, not one day earlier', async ({ page }) => {
    // Regression test for the timezone off-by-one bug fixed earlier this
    // session in backend/src/server.js toISODate() — verifies the fix holds.
    const csv = [
      'Module,Metric,Value',
      '"Timeline & Team","Actual End Date (YYYY-MM-DD)","6/25/2026"',
      '"Green Ops","Energy Consumption (MWh)","555"',
    ].join('\n');

    await page.setInputFiles('input[type="file"]', {
      name: 'upload.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    // Bulk-update upserts 6 tables; under load this can take longer than the default 5s.
    await expect(page.getByText('All metrics updated successfully!')).toBeVisible({ timeout: 15000 });

    const detail = await api.getEventDetail(eventId);
    expect(detail.timeline_actual_end_date).toBe('2026-06-25'); // not 2026-06-24
    expect(detail.total_energy_mwh).toBe(555);
  });
});
