/**
 * Supabase migration script.
 * Runs schema.sql and seeds dummy data via the session pooler.
 * Usage: node scripts/migrate.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ── Credentials ─────────────────────────────────────────────────
const PROJECT_REF  = 'rvndetvetovcnaievyoq';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2bmRldHZldG92Y25haWV2eW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTEwNzE2MCwiZXhwIjoyMDk2NjgzMTYwfQ.5VSbNLaLDGXI-o4ur103yWqijGmn_IDbFBoIbyvuDtk';

// Session pooler regions to try (ap-southeast-1 first for Malaysia)
const HOSTS = [
  `aws-0-ap-southeast-1.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-2.pooler.supabase.com`,
];

// ── Dummy data ───────────────────────────────────────────────────
const DUMMY_SQL = `
-- Dummy events for testing and charting
INSERT INTO public.events (
  event_name, client_name, event_location, reporting_year, event_status,
  event_start_date, event_end_date,
  total_energy_mwh, renewable_energy_pct, total_water_m3,
  waste_hazardous_kg, waste_nonhazardous_kg, waste_recycled_kg,
  waste_composted_kg, waste_diverted_pct, sustainable_catering_pct, food_recovery_kg,
  scope1_tco2e, scope2_lb_tco2e, scope3_tco2e,
  fatalities_count, ltir, lti_count, man_hours_actual, safety_trained_count,
  staff_permanent_count, staff_contractor_count, contractor_pct, hr_complaints_count,
  training_hours_total, turnover_count, crew_female_count, crew_male_count,
  procurement_total_rm, local_supplier_spend_rm, local_supplier_spend_pct,
  green_procurement_rm, community_invest_rm, community_beneficiaries, data_breach_complaints,
  budget_estimated, budget_actual, revenue_estimated, revenue_actual, green_spend_rm,
  team_size_total, expected_attendance, actual_attendance
)
SELECT
  e.event_name, e.client_name, e.event_location, e.reporting_year, e.event_status,
  e.event_start_date::date, e.event_end_date::date,
  e.total_energy_mwh, e.renewable_energy_pct, e.total_water_m3,
  e.waste_hazardous_kg, e.waste_nonhazardous_kg, e.waste_recycled_kg,
  e.waste_composted_kg, e.waste_diverted_pct, e.sustainable_catering_pct, e.food_recovery_kg,
  e.scope1_tco2e, e.scope2_lb_tco2e, e.scope3_tco2e,
  e.fatalities_count, e.ltir, e.lti_count, e.man_hours_actual, e.safety_trained_count,
  e.staff_permanent_count, e.staff_contractor_count, e.contractor_pct, e.hr_complaints_count,
  e.training_hours_total, e.turnover_count, e.crew_female_count, e.crew_male_count,
  e.procurement_total_rm, e.local_supplier_spend_rm, e.local_supplier_spend_pct,
  e.green_procurement_rm, e.community_invest_rm, e.community_beneficiaries, e.data_breach_complaints,
  e.budget_estimated, e.budget_actual, e.revenue_estimated, e.revenue_actual, e.green_spend_rm,
  e.team_size_total, e.expected_attendance, e.actual_attendance
FROM (VALUES
  ('Green Tech Summit 2025','Axiata Group Berhad','KLCC, Kuala Lumpur','2025','Completed',
   '2025-03-10','2025-03-12',
   48.5,32.0,120.0,
   45.0,380.0,280.0,95.0,78.6,65.0,42.0,
   2.8,8.4,18.2,
   0,0.0,0,24000.0,320,
   280,85,23.3,0,
   4200.0,8,110,170,
   380000.0,220000.0,57.9,45000.0,15000.0,1200,0,
   520000.0,505000.0,680000.0,710000.0,48000.0,
   42,1800,1650),

  ('Sustainability Forum ASEAN','CIMB Group','Menara CIMB, KL','2025','Active',
   '2025-05-20','2025-05-22',
   32.1,18.5,85.0,
   28.0,210.0,145.0,55.0,66.7,55.0,28.0,
   1.9,5.7,12.1,
   0,0.0,0,16000.0,210,
   195,60,23.5,0,
   2800.0,5,75,120,
   240000.0,140000.0,58.3,30000.0,10000.0,800,0,
   360000.0,345000.0,440000.0,460000.0,34000.0,
   28,1200,1100),

  ('ESG Leadership Conference','Bursa Malaysia','Shangri-La KL','2025','Planned',
   '2025-08-14','2025-08-15',
   18.0,22.0,55.0,
   15.0,120.0,90.0,28.0,77.5,70.0,18.0,
   1.1,3.3,7.5,
   0,0.0,0,9600.0,120,
   110,40,26.7,0,
   1500.0,3,40,70,
   145000.0,90000.0,62.1,22000.0,8000.0,400,0,
   210000.0,0.0,280000.0,0.0,22000.0,
   15,650,0),

  ('Green Building Expo 2024','MRCB Quill REIT','MITEC, Kepong','2024','Completed',
   '2024-09-05','2024-09-07',
   65.2,14.2,180.0,
   62.0,520.0,350.0,120.0,71.5,48.0,55.0,
   3.9,11.4,26.8,
   0,0.83,1,24000.0,410,
   360,110,23.4,1,
   5200.0,12,130,230,
   510000.0,290000.0,56.9,55000.0,18000.0,2100,0,
   690000.0,675000.0,850000.0,820000.0,62000.0,
   58,2400,2280),

  ('Climate Action Week 2024','Petronas','KLCC Park','2024','Completed',
   '2024-11-18','2024-11-22',
   82.4,28.6,240.0,
   80.0,640.0,480.0,160.0,80.0,72.0,68.0,
   4.9,14.2,33.0,
   0,0.0,0,38400.0,520,
   480,140,22.6,0,
   7800.0,10,190,290,
   640000.0,380000.0,59.4,75000.0,24000.0,3200,1,
   890000.0,870000.0,1100000.0,1080000.0,82000.0,
   72,3000,2950)
) AS e(
  event_name, client_name, event_location, reporting_year, event_status,
  event_start_date, event_end_date,
  total_energy_mwh, renewable_energy_pct, total_water_m3,
  waste_hazardous_kg, waste_nonhazardous_kg, waste_recycled_kg,
  waste_composted_kg, waste_diverted_pct, sustainable_catering_pct, food_recovery_kg,
  scope1_tco2e, scope2_lb_tco2e, scope3_tco2e,
  fatalities_count, ltir, lti_count, man_hours_actual, safety_trained_count,
  staff_permanent_count, staff_contractor_count, contractor_pct, hr_complaints_count,
  training_hours_total, turnover_count, crew_female_count, crew_male_count,
  procurement_total_rm, local_supplier_spend_rm, local_supplier_spend_pct,
  green_procurement_rm, community_invest_rm, community_beneficiaries, data_breach_complaints,
  budget_estimated, budget_actual, revenue_estimated, revenue_actual, green_spend_rm,
  team_size_total, expected_attendance, actual_attendance
)
WHERE NOT EXISTS (SELECT 1 FROM public.events LIMIT 1);
`;

// ── Corporate governance seed ────────────────────────────────────
const GOV_SEED_SQL = `
UPDATE public.corporate_governance SET data = '{
  "gov_committee_name": "Sustainability & ESG Committee",
  "gov_meeting_frequency": "Quarterly",
  "gov_board_oversight_text": "The Board reviews ESG performance against key metrics on a quarterly basis through the Sustainability Committee.",
  "gov_strategy_integration_text": "ESG considerations are integrated into our annual strategic planning process and capital allocation decisions.",
  "gov_executive_accountability_text": "Executive KPIs include ESG targets with 15% weighting in annual performance reviews.",
  "risk_erm_integration_status": "Fully Integrated",
  "risk_identification_text": "Climate, regulatory, and reputational ESG risks are identified via annual enterprise risk management review.",
  "risk_assessment_text": "Two climate scenario analyses completed: 1.5°C Paris-aligned and 4°C business-as-usual scenarios.",
  "board_male_pct": 62,
  "board_female_pct": 38,
  "board_under30_pct": 0,
  "board_30to50_pct": 45,
  "board_over50_pct": 55,
  "anticorrupt_training_coverage": 98.5,
  "corruption_risk_assessment_pct": 100,
  "confirmed_corruption_incidents": 0,
  "climate_transition_risk_rm": 450000,
  "climate_transition_risk_pct": 8.2,
  "climate_physical_risk_rm": 280000,
  "climate_physical_risk_pct": 5.1,
  "climate_opportunities_rm": 1200000,
  "climate_opportunities_pct": 21.8,
  "climate_capex_rm": 320000,
  "internal_carbon_price": 25,
  "exec_climate_remun_pct": 15,
  "fin_position_impact_rm": 730000,
  "fin_position_impact_pct": 13.3,
  "fin_position_time_horizon": "3–5 years"
}'::jsonb
WHERE id = (SELECT id FROM public.corporate_governance LIMIT 1);
`;

// ── Run migration ────────────────────────────────────────────────
async function run() {
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  let lastErr = null;
  for (const host of HOSTS) {
    const client = new Client({
      host,
      port: 6543,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      process.stdout.write(`Trying ${host}... `);
      await client.connect();
      console.log('connected!');

      console.log('Running schema.sql...');
      await client.query(schema);
      console.log('Schema applied.');

      console.log('Seeding dummy events...');
      await client.query(DUMMY_SQL);
      console.log('Dummy data inserted (skipped if events already exist).');

      console.log('Seeding corporate governance...');
      await client.query(GOV_SEED_SQL);
      console.log('Governance data seeded.');

      await client.end();
      console.log('\nMigration complete!');
      return;
    } catch (err) {
      lastErr = err;
      console.log(`failed: ${err.message.split('\n')[0]}`);
      try { await client.end(); } catch {}
    }
  }

  console.error('\nAll hosts failed. Last error:', lastErr?.message);
  process.exit(1);
}

run();
