-- ═══════════════════════════════════════════════════════════════════
-- Dummy data seed — run AFTER schema.sql
-- Idempotent: skips all inserts if events already exist.
-- ═══════════════════════════════════════════════════════════════════
do $seed$
begin

-- ── Guard: skip everything if events table already has rows ─────────
if exists (select 1 from public.events limit 1) then
  raise notice 'Seed skipped — events already exist.';
  return;
end if;

-- ── Insert 5 events ────────────────────────────────────────────────
insert into public.events (id, organisation_id, event_name, client_name, event_location, event_type, event_status, reporting_year, event_start_date, event_end_date) values
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Green Tech Summit 2025', 'Axiata Group Berhad', 'KLCC, Kuala Lumpur',
   'conference', 'Completed', '2025', '2025-03-10', '2025-03-12'),

  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Sustainability Forum ASEAN', 'CIMB Group', 'Menara CIMB, Kuala Lumpur',
   'forum', 'Active', '2025', '2025-05-20', '2025-05-22'),

  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'ESG Leadership Conference', 'Bursa Malaysia', 'Shangri-La Hotel, KL',
   'conference', 'Planned', '2025', '2025-08-14', '2025-08-15'),

  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Green Building Expo 2024', 'MRCB Quill REIT', 'MITEC, Kepong',
   'exhibition', 'Completed', '2024', '2024-09-05', '2024-09-07'),

  ('10000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Climate Action Week 2024', 'Petronas', 'KLCC Park, Kuala Lumpur',
   'campaign', 'Completed', '2024', '2024-11-18', '2024-11-22');

-- ── Module A: Green Ops ────────────────────────────────────────────
insert into public.module_green_ops
  (event_id, total_energy_mwh, renewable_energy_mwh, total_water_m3,
   hazardous_waste_tonnes, nonhazardous_waste_tonnes, waste_diverted_tonnes,
   sustainable_catering_pct, surplus_food_recovered_kg,
   ghg_scope1_tco2e, ghg_scope2_tco2e, ghg_scope3_tco2e) values

  ('10000000-0000-0000-0000-000000000001', 48.5, 15.5, 120.0, 0.045, 0.380, 0.375, 65.0, 42.0, 2.8, 8.4, 18.2),
  ('10000000-0000-0000-0000-000000000002', 32.1,  5.9,  85.0, 0.028, 0.210, 0.200, 55.0, 28.0, 1.9, 5.7, 12.1),
  ('10000000-0000-0000-0000-000000000003', 18.0,  3.9,  55.0, 0.015, 0.120, 0.100, 70.0, 18.0, 1.1, 3.3,  7.5),
  ('10000000-0000-0000-0000-000000000004', 65.2,  9.3, 180.0, 0.062, 0.520, 0.470, 48.0, 55.0, 3.9,11.4, 26.8),
  ('10000000-0000-0000-0000-000000000005', 82.4, 23.6, 240.0, 0.080, 0.640, 0.640, 72.0, 68.0, 4.9,14.2, 33.0);

-- ── Module B: Health, Safety & Labour ─────────────────────────────
insert into public.module_health_safety_labour
  (event_id, work_related_fatalities, lti_count, total_hours_worked,
   safety_training_headcount, total_headcount, contract_temp_count,
   human_rights_complaints, training_hours_total, employee_turnover_count) values

  ('10000000-0000-0000-0000-000000000001', 0, 0, 24000.0, 320, 365, 85, 0, 4200.0,  8),
  ('10000000-0000-0000-0000-000000000002', 0, 0, 16000.0, 210, 255, 60, 0, 2800.0,  5),
  ('10000000-0000-0000-0000-000000000003', 0, 0,  9600.0, 120, 150, 40, 0, 1500.0,  3),
  ('10000000-0000-0000-0000-000000000004', 0, 1, 24000.0, 410, 470,110, 1, 5200.0, 12),
  ('10000000-0000-0000-0000-000000000005', 0, 0, 38400.0, 520, 620,140, 0, 7800.0, 10);

-- ── Module C: Procurement & Community ────────────────────────────
insert into public.module_procurement_community
  (event_id, total_procurement_spend_rm, local_supplier_spend_rm,
   community_investment_rm, community_beneficiaries, privacy_breaches_count) values

  ('10000000-0000-0000-0000-000000000001', 380000.0, 220000.0, 15000.0, 1200, 0),
  ('10000000-0000-0000-0000-000000000002', 240000.0, 140000.0, 10000.0,  800, 0),
  ('10000000-0000-0000-0000-000000000003', 145000.0,  90000.0,  8000.0,  400, 0),
  ('10000000-0000-0000-0000-000000000004', 510000.0, 290000.0, 18000.0, 2100, 0),
  ('10000000-0000-0000-0000-000000000005', 640000.0, 380000.0, 24000.0, 3200, 1);

-- ── Event Financials ──────────────────────────────────────────────
insert into public.event_financials
  (event_id, budget_estimated, budget_actual, revenue_estimated, revenue_actual, green_spend_rm) values

  ('10000000-0000-0000-0000-000000000001', 520000.0, 505000.0, 680000.0, 710000.0, 48000.0),
  ('10000000-0000-0000-0000-000000000002', 360000.0, 345000.0, 440000.0, 460000.0, 34000.0),
  ('10000000-0000-0000-0000-000000000003', 210000.0,      0.0, 280000.0,      0.0, 22000.0),
  ('10000000-0000-0000-0000-000000000004', 690000.0, 675000.0, 850000.0, 820000.0, 62000.0),
  ('10000000-0000-0000-0000-000000000005', 890000.0, 870000.0,1100000.0,1080000.0, 82000.0);

-- ── Event Timeline ────────────────────────────────────────────────
insert into public.event_timeline
  (event_id, project_start_date, planned_end_date, actual_end_date, tasks_total, tasks_on_time, team_size) values

  ('10000000-0000-0000-0000-000000000001', '2025-01-15', '2025-03-12', '2025-03-12', 24, 22, 42),
  ('10000000-0000-0000-0000-000000000002', '2025-03-01', '2025-05-22',          null, 18,  0, 28),
  ('10000000-0000-0000-0000-000000000003', '2025-05-01', '2025-08-15',          null, 12,  0, 15),
  ('10000000-0000-0000-0000-000000000004', '2024-06-01', '2024-09-07', '2024-09-09', 30, 26, 58),
  ('10000000-0000-0000-0000-000000000005', '2024-09-01', '2024-11-22', '2024-11-22', 35, 33, 72);

-- ── Event Attendance ──────────────────────────────────────────────
insert into public.event_attendance
  (event_id, expected_attendance, actual_attendance) values

  ('10000000-0000-0000-0000-000000000001', 1800, 1650),
  ('10000000-0000-0000-0000-000000000002', 1200, 1100),
  ('10000000-0000-0000-0000-000000000003',  650,    0),
  ('10000000-0000-0000-0000-000000000004', 2400, 2280),
  ('10000000-0000-0000-0000-000000000005', 3000, 2950);

-- ── Module D: Strategy & Risk (org-level) ─────────────────────────
update public.module_strategy_risk
set
  gov_committee_name              = 'Sustainability & ESG Committee',
  gov_meeting_frequency           = 'Quarterly',
  gov_board_oversight_text        = 'The Board reviews ESG performance against key metrics on a quarterly basis through the Sustainability Committee.',
  gov_strategy_integration_text   = 'ESG considerations are integrated into our annual strategic planning process and capital allocation decisions.',
  gov_executive_accountability_text = 'Executive KPIs include ESG targets with 15% weighting in annual performance reviews.',
  risk_erm_integration_status     = 'Fully Integrated',
  risk_identification_text        = 'Climate, regulatory, and reputational ESG risks are identified via annual enterprise risk management review.',
  risk_assessment_text            = 'Two climate scenario analyses completed: 1.5°C Paris-aligned and 4°C business-as-usual scenarios.'
where organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- ── Module E: HR & Diversity (org-level) ─────────────────────────
update public.module_hr_diversity
set
  emp_total = 1200, emp_female = 504, emp_male = 696,
  board_total = 8, board_female = 3, board_male = 5,
  board_male_pct                  = 62.0,
  board_female_pct                = 38.0,
  board_under30_pct               = 0.0,
  board_30to50_pct                = 45.0,
  board_over50_pct                = 55.0,
  anticorrupt_training_coverage   = 98.5,
  corruption_risk_assessment_pct  = 100.0,
  confirmed_corruption_incidents  = 0
where organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- ── Module F: Climate Finance (org-level) ────────────────────────
update public.module_climate_finance
set
  climate_transition_risk_rm  = 450000,  climate_transition_risk_pct  = 8.2,
  climate_physical_risk_rm    = 280000,  climate_physical_risk_pct    = 5.1,
  climate_chronic_risk_rm     = 120000,  climate_chronic_risk_pct     = 2.2,
  climate_opportunities_rm    = 1200000, climate_opportunities_pct    = 21.8,
  climate_capex_rm            = 320000,
  internal_carbon_price       = 25,
  exec_climate_remun_pct      = 15,
  fin_position_impact_rm      = 730000,
  fin_position_impact_pct     = 13.3,
  fin_position_time_horizon   = '3–5 years'
where organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

end $seed$;
