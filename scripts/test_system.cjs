/**
 * Full system test suite — runs against the live Supabase instance.
 * Reads SUPABASE_URL / SUPABASE_ANON_KEY from backend/.env.
 * Run after scripts/reseed_events.js has seeded the dummy data.
 * Usage: node scripts/test_system.cjs
 */
const https  = require('https');
const path   = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON         = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env first.');
  process.exit(1);
}

const BASE  = SUPABASE_URL + '/rest/v1';
const HDRS  = { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const ORG   = '00000000-0000-0000-0000-000000000001';

const api = (method, path, body) => new Promise((resolve, reject) => {
  const url = new URL(BASE + path);
  const r = https.request(url, { method, headers: HDRS }, resp => {
    let d = '';
    resp.on('data', c => d += c);
    resp.on('end', () => {
      try { resolve({ status: resp.statusCode, data: JSON.parse(d) }); }
      catch { resolve({ status: resp.statusCode, data: d }); }
    });
  });
  r.on('error', reject);
  if (body) r.write(JSON.stringify(body));
  r.end();
});

let passed = 0, failed = 0;
const ok = (label, cond, info = '') => {
  if (cond) { console.log('  PASS', label); passed++; }
  else { console.log('  FAIL', label, info || ''); failed++; }
};
const close = (a, b, tol = 0.05) => typeof a === 'number' && Math.abs(a - b) < tol;

(async () => {
  // ── Test 1: Events List ────────────────────────────────────────
  console.log('\n[1] Events List (getEvents)');
  const evRes = await api('GET', '/events?deleted_at=is.null&order=created_at.desc&select=id,event_name,event_status,reporting_year');
  ok('Returns array', Array.isArray(evRes.data));
  ok('Has 12 events', evRes.data.length === 12);
  ok('event_name present', !!evRes.data[0]?.event_name);
  ok('No module fields leaked', evRes.data[0]?.total_energy_mwh === undefined);

  // ── Test 2: Events Flat View ───────────────────────────────────
  console.log('\n[2] Events Flat View (getEventsFull / Dashboard)');
  const flatRes = await api('GET', '/events_flat?order=created_at.desc');
  ok('Returns array', Array.isArray(flatRes.data));
  ok('Has 12 rows', flatRes.data.length === 12);
  const ev1 = flatRes.data.find(x => x.id === 'e0000000-0000-0000-0000-000000000001');
  ok('Green Building Expo 2024 found', ev1?.event_name === 'Green Building Expo 2024');
  ok('total_energy_mwh = 71.2', ev1?.total_energy_mwh === 71.2);
  ok('renewable_energy_pct is number', typeof ev1?.renewable_energy_pct === 'number');
  ok('scope1_tco2e = 4.2', ev1?.scope1_tco2e === 4.2);
  ok('ltir present', ev1?.ltir !== undefined);
  ok('safety_trained_count = 430', ev1?.safety_trained_count === 430);
  ok('local_supplier_spend_pct > 0', ev1?.local_supplier_spend_pct > 0);
  ok('community_invest_rm = 20000', ev1?.community_invest_rm === 20000);
  ok('budget_estimated = 740000', ev1?.budget_estimated === 740000);
  ok('revenue_actual = 952000', ev1?.revenue_actual === 952000);
  ok('team_size_total = 64', ev1?.team_size_total === 64);
  ok('expected_attendance = 2800', ev1?.expected_attendance === 2800);
  ok('actual_attendance = 2650', ev1?.actual_attendance === 2650);

  // ── Test 3: Single Event Detail ────────────────────────────────
  console.log('\n[3] Event Detail (getEventDetail)');
  const detailRes = await api('GET', '/events_flat?id=eq.e0000000-0000-0000-0000-000000000001');
  ok('Single event returned', detailRes.data.length === 1);
  ok('Correct event', detailRes.data[0]?.event_name === 'Green Building Expo 2024');
  ok('waste_diverted_pct present', detailRes.data[0]?.waste_diverted_pct !== undefined);
  ok('contractor_pct present', detailRes.data[0]?.contractor_pct !== undefined);

  // ── Test 4: GENERATED Columns ──────────────────────────────────
  console.log('\n[4] GENERATED Columns');
  const genRes = await api('GET', '/module_green_ops?select=event_id,renewable_energy_pct,waste_diversion_pct&limit=12');
  ok('module_green_ops has GENERATED cols', genRes.data.every(r => r.renewable_energy_pct !== undefined));
  const gen1 = genRes.data.find(r => r.event_id === 'e0000000-0000-0000-0000-000000000001');
  ok('renewable_energy_pct computed correctly (~13.76)', close(gen1?.renewable_energy_pct, 13.76));

  const finGen = await api('GET', '/event_financials?select=event_id,net_profit,roi_pct,budget_variance&limit=12');
  ok('event_financials GENERATED cols present', finGen.data.every(r => r.net_profit !== undefined));
  const fin1 = finGen.data.find(r => r.event_id === 'e0000000-0000-0000-0000-000000000001');
  ok('net_profit = 234000 (952000-718000)', fin1?.net_profit === 234000);
  ok('budget_variance = 22000 (740000-718000)', fin1?.budget_variance === 22000);

  const attGen = await api('GET', '/event_attendance?select=event_id,attendance_rate_pct&limit=12');
  const att1 = attGen.data.find(r => r.event_id === 'e0000000-0000-0000-0000-000000000001');
  ok('attendance_rate_pct ~94.64', close(att1?.attendance_rate_pct, 94.64));

  // ── Test 5: Corporate Governance Modules ──────────────────────
  console.log('\n[5] Corporate Governance');
  const srRes = await api('GET', '/module_strategy_risk?organisation_id=eq.' + ORG + '&reporting_year=eq.2025');
  ok('module_strategy_risk row exists', srRes.data.length > 0);
  ok('gov_committee_name set', !!srRes.data[0]?.gov_committee_name);
  ok('risk_erm_integration_status = Fully Integrated', srRes.data[0]?.risk_erm_integration_status === 'Fully Integrated');

  const hrRes = await api('GET', '/module_hr_diversity?organisation_id=eq.' + ORG + '&reporting_year=eq.2025');
  ok('module_hr_diversity row exists', hrRes.data.length > 0);
  ok('board_male_pct = 62', hrRes.data[0]?.board_male_pct === 62);
  ok('board_female_pct = 38', hrRes.data[0]?.board_female_pct === 38);
  ok('anticorrupt_training_coverage = 98.5', hrRes.data[0]?.anticorrupt_training_coverage === 98.5);
  ok('confirmed_corruption_incidents = 0', hrRes.data[0]?.confirmed_corruption_incidents === 0);

  const cfRes = await api('GET', '/module_climate_finance?organisation_id=eq.' + ORG + '&reporting_year=eq.2025');
  ok('module_climate_finance row exists', cfRes.data.length > 0);
  ok('internal_carbon_price = 25', cfRes.data[0]?.internal_carbon_price === 25);
  ok('climate_transition_risk_rm = 450000', cfRes.data[0]?.climate_transition_risk_rm === 450000);

  // ── Test 6: Create New Event ───────────────────────────────────
  console.log('\n[6] Create Event (saveEvent)');
  const createRes = await api('POST', '/events', {
    event_name: '_TEST_SYSTEM_CHECK_',
    client_name: 'Test Client',
    event_location: 'Test Venue',
    event_status: 'Draft',
    reporting_year: '2025',
    organisation_id: ORG,
  });
  ok('Create returns 201', createRes.status === 201);
  const testId = Array.isArray(createRes.data) ? createRes.data[0]?.id : createRes.data?.id;
  ok('New event has UUID', !!testId);

  if (testId) {
    // ── Test 7: Save Module Data ─────────────────────────────────
    console.log('\n[7] Save Module Data (upserts)');
    const gopRes = await api('POST', '/module_green_ops?on_conflict=event_id', {
      event_id: testId, total_energy_mwh: 20, renewable_energy_mwh: 8,
      hazardous_waste_tonnes: 0.02, nonhazardous_waste_tonnes: 0.08, waste_diverted_tonnes: 0.06,
      ghg_scope1_tco2e: 1.5, ghg_scope2_tco2e: 2.5, ghg_scope3_tco2e: 6.0,
      total_water_m3: 80, sustainable_catering_pct: 55, surplus_food_recovered_kg: 30,
    });
    ok('Insert module_green_ops', gopRes.status === 201);

    const gcheck = await api('GET', '/module_green_ops?event_id=eq.' + testId + '&select=renewable_energy_pct,waste_diversion_pct');
    ok('renewable_energy_pct auto-calculated (=40)', gcheck.data[0]?.renewable_energy_pct === 40);
    ok('waste_diversion_pct auto-calculated (=60)', gcheck.data[0]?.waste_diversion_pct === 60);

    const hlRes = await api('POST', '/module_health_safety_labour?on_conflict=event_id', {
      event_id: testId, work_related_fatalities: 0, lti_count: 1, total_hours_worked: 10000,
      safety_training_headcount: 50, total_headcount: 80, contract_temp_count: 20,
      human_rights_complaints: 0, training_hours_total: 500, employee_turnover_count: 3,
    });
    ok('Insert module_health_safety_labour', hlRes.status === 201);

    const hlcheck = await api('GET', '/module_health_safety_labour?event_id=eq.' + testId + '&select=ltir,contract_temp_ratio_pct');
    ok('ltir auto-calculated (=20)', hlcheck.data[0]?.ltir === 20);
    ok('contract_temp_ratio_pct auto-calculated (=25)', hlcheck.data[0]?.contract_temp_ratio_pct === 25);

    const pcRes = await api('POST', '/module_procurement_community?on_conflict=event_id', {
      event_id: testId, total_procurement_spend_rm: 100000, local_supplier_spend_rm: 60000,
      community_investment_rm: 5000, community_beneficiaries: 200, privacy_breaches_count: 0,
    });
    ok('Insert module_procurement_community', pcRes.status === 201);

    const pccheck = await api('GET', '/module_procurement_community?event_id=eq.' + testId + '&select=local_supplier_spend_pct');
    ok('local_supplier_spend_pct auto-calculated (=60)', pccheck.data[0]?.local_supplier_spend_pct === 60);

    const finRes = await api('POST', '/event_financials?on_conflict=event_id', {
      event_id: testId, budget_estimated: 200000, budget_actual: 180000,
      revenue_estimated: 250000, revenue_actual: 240000, green_spend_rm: 12000,
    });
    ok('Insert event_financials', finRes.status === 201);

    const fcheck = await api('GET', '/event_financials?event_id=eq.' + testId + '&select=net_profit,roi_pct,budget_variance');
    ok('net_profit auto-calculated (=60000)', fcheck.data[0]?.net_profit === 60000);
    ok('budget_variance auto-calculated (=20000)', fcheck.data[0]?.budget_variance === 20000);

    const tlRes = await api('POST', '/event_timeline?on_conflict=event_id', {
      event_id: testId, project_start_date: '2025-01-01', planned_end_date: '2025-06-30',
      actual_end_date: '2025-07-05', tasks_total: 20, tasks_on_time: 16, team_size: 10,
    });
    ok('Insert event_timeline', tlRes.status === 201);

    const tlcheck = await api('GET', '/event_timeline?event_id=eq.' + testId + '&select=schedule_variance_days,on_time_delivery_pct');
    ok('schedule_variance_days auto-calculated (=-5)', tlcheck.data[0]?.schedule_variance_days === -5);
    ok('on_time_delivery_pct auto-calculated (=80)', tlcheck.data[0]?.on_time_delivery_pct === 80);

    const attRes = await api('POST', '/event_attendance?on_conflict=event_id', {
      event_id: testId, expected_attendance: 500, actual_attendance: 450,
    });
    ok('Insert event_attendance', attRes.status === 201);

    const atcheck = await api('GET', '/event_attendance?event_id=eq.' + testId + '&select=attendance_rate_pct');
    ok('attendance_rate_pct auto-calculated (=90)', atcheck.data[0]?.attendance_rate_pct === 90);

    // Verify merged view
    const flatTest = await api('GET', '/events_flat?id=eq.' + testId);
    ok('Test event visible in events_flat', flatTest.data.length === 1);
    ok('Module data merged into flat view', flatTest.data[0]?.total_energy_mwh === 20);

    // ── Test 8: Soft Delete ──────────────────────────────────────
    console.log('\n[8] Soft Delete (deleteEvent)');
    const delRes = await api('PATCH', '/events?id=eq.' + testId, { deleted_at: new Date().toISOString() });
    ok('Soft delete returns 200', delRes.status === 200);

    const afterDel = await api('GET', '/events_flat?id=eq.' + testId);
    ok('Deleted event hidden from events_flat', afterDel.data.length === 0);

    const mainList = await api('GET', '/events?deleted_at=is.null&select=id');
    ok('Main events list still has 12 rows', mainList.data.length === 12);
  }

  // ── Test 9: Year Aggregation ───────────────────────────────────
  console.log('\n[9] Year Aggregation (Dashboard filter)');
  const y2026 = await api('GET', '/events_flat?reporting_year=eq.2026');
  const y2025 = await api('GET', '/events_flat?reporting_year=eq.2025');
  const y2024 = await api('GET', '/events_flat?reporting_year=eq.2024');
  ok('2026 events = 3', y2026.data.length === 3);
  ok('2025 events = 5', y2025.data.length === 5);
  ok('2024 events = 4', y2024.data.length === 4);
  const total2025Energy = y2025.data.reduce((a, e) => a + (e.total_energy_mwh || 0), 0);
  ok('2025 total energy > 0', total2025Energy > 0);

  // ── Test 10: App Settings ──────────────────────────────────────
  console.log('\n[10] App Settings');
  const settingsRes = await api('GET', '/app_settings?select=data&limit=1');
  ok('app_settings returns data', settingsRes.data.length > 0);
  ok('grid_emission_factor = 0.694', settingsRes.data[0]?.data?.grid_emission_factor === 0.694);
  ok('reporting_frameworks present', Array.isArray(settingsRes.data[0]?.data?.reporting_frameworks));

  // ── Results ────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('RESULTS:', passed, 'passed,', failed, 'failed');
  if (failed === 0) console.log('ALL TESTS PASSED');
  else console.log('SOME TESTS FAILED — see FAIL lines above');
  console.log('════════════════════════════════════════');
})();
