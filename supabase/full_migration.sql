-- ═══════════════════════════════════════════════════════════════════
-- Green Generation ESG Platform — Normalised Supabase Schema
-- Run in the Supabase SQL Editor (or via migrate.cjs).
-- Idempotent: safe to re-run (CREATE IF NOT EXISTS throughout).
-- ═══════════════════════════════════════════════════════════════════

-- Uncomment to fully reset:
-- drop schema public cascade; create schema public;

-- ───────────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at
-- ───────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: organisations
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.organisations (
  id                  uuid        default gen_random_uuid() primary key,
  name                text        not null,
  registration_number text        not null default '',
  industry_sector     text        not null default '',
  created_at          timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: events  (one row per event/project)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.events (
  id               uuid        default gen_random_uuid() primary key,
  organisation_id  uuid        references public.organisations(id),
  event_name       text        not null,
  client_name      text        not null default '',
  event_location   text        not null default '',
  event_type       text        not null default 'conference',
  event_status     text        not null default 'Draft',
  reporting_year   text        not null default '2025',
  event_start_date date,
  event_end_date   date,
  description      text        not null default '',
  created_by       uuid,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_team_members
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.event_team_members (
  id          uuid        default gen_random_uuid() primary key,
  event_id    uuid        not null references public.events(id) on delete cascade,
  full_name   text        not null,
  role        text        not null default '',
  member_type text        not null default 'staff',  -- staff | volunteer | contractor
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- MODULE A: module_green_ops  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_green_ops (
  id                        uuid        default gen_random_uuid() primary key,
  event_id                  uuid        not null unique references public.events(id) on delete cascade,
  submitted_by              uuid,

  -- Energy
  total_energy_mwh          float8      not null default 0,
  renewable_energy_mwh      float8      not null default 0,
  renewable_energy_pct      float8      generated always as (
    case when total_energy_mwh > 0
    then round((renewable_energy_mwh / total_energy_mwh * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  -- Water
  total_water_m3            float8      not null default 0,

  -- Waste (in tonnes)
  hazardous_waste_tonnes    float8      not null default 0,
  nonhazardous_waste_tonnes float8      not null default 0,
  waste_diverted_tonnes     float8      not null default 0,
  waste_diversion_pct       float8      generated always as (
    case when (hazardous_waste_tonnes + nonhazardous_waste_tonnes) > 0
    then round((waste_diverted_tonnes / (hazardous_waste_tonnes + nonhazardous_waste_tonnes) * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  -- Catering
  sustainable_catering_pct  float8      not null default 0,
  surplus_food_recovered_kg float8      not null default 0,

  -- GHG Emissions
  ghg_scope1_tco2e          float8      not null default 0,
  ghg_scope2_tco2e          float8      not null default 0,
  ghg_scope3_tco2e          float8      not null default 0,
  ghg_scope3_doc_url        text,

  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create or replace trigger green_ops_updated_at
  before update on public.module_green_ops
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- MODULE B: module_health_safety_labour  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_health_safety_labour (
  id                          uuid        default gen_random_uuid() primary key,
  event_id                    uuid        not null unique references public.events(id) on delete cascade,
  submitted_by                uuid,

  -- Health & Safety
  work_related_fatalities     int         not null default 0,
  lti_count                   int         not null default 0,
  total_hours_worked          float8      not null default 0,
  ltir                        float8      generated always as (
    case when total_hours_worked > 0
    then round((lti_count * 200000.0 / total_hours_worked)::numeric, 4)::float8
    else 0.0 end
  ) stored,
  safety_training_headcount   int         not null default 0,

  -- Labour
  total_headcount             int         not null default 0,
  contract_temp_count         int         not null default 0,
  contract_temp_ratio_pct     float8      generated always as (
    case when total_headcount > 0
    then round((contract_temp_count::float8 / total_headcount * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,
  human_rights_complaints     int         not null default 0,
  training_hours_total        float8      not null default 0,
  employee_turnover_count     int         not null default 0,

  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create or replace trigger health_updated_at
  before update on public.module_health_safety_labour
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- MODULE C: module_procurement_community  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_procurement_community (
  id                          uuid        default gen_random_uuid() primary key,
  event_id                    uuid        not null unique references public.events(id) on delete cascade,
  submitted_by                uuid,

  total_procurement_spend_rm  float8      not null default 0,
  local_supplier_spend_rm     float8      not null default 0,
  local_supplier_spend_pct    float8      generated always as (
    case when total_procurement_spend_rm > 0
    then round((local_supplier_spend_rm / total_procurement_spend_rm * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,
  community_investment_rm     float8      not null default 0,
  community_beneficiaries     int         not null default 0,
  privacy_breaches_count      int         not null default 0,

  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create or replace trigger procurement_updated_at
  before update on public.module_procurement_community
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- MODULE D: module_strategy_risk  (org-level)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_strategy_risk (
  id                              uuid        default gen_random_uuid() primary key,
  organisation_id                 uuid        not null references public.organisations(id),
  reporting_year                  text        not null default '2025',
  unique (organisation_id, reporting_year),

  -- Governance
  gov_committee_name              text,
  gov_meeting_frequency           text,
  gov_board_oversight_text        text,
  gov_strategy_integration_text   text,
  gov_executive_accountability_text text,

  -- Risk Management
  risk_erm_integration_status     text,
  risk_identification_text        text,
  risk_assessment_text            text,

  -- Strategy
  strategy_short_text             text,
  strategy_medium_text            text,
  strategy_long_text              text,
  scenario_analysis_text          text,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create or replace trigger strategy_updated_at
  before update on public.module_strategy_risk
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- MODULE E: module_hr_diversity  (org-level)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_hr_diversity (
  id                              uuid        default gen_random_uuid() primary key,
  organisation_id                 uuid        not null references public.organisations(id),
  reporting_year                  text        not null default '2025',
  unique (organisation_id, reporting_year),

  -- Employee counts
  emp_total                       int         not null default 0,
  emp_female                      int         not null default 0,
  emp_male                        int         not null default 0,

  -- Board diversity (stored as direct inputs — pct entered by user)
  board_total                     int         not null default 0,
  board_female                    int         not null default 0,
  board_male                      int         not null default 0,
  board_male_pct                  float8      not null default 0,
  board_female_pct                float8      not null default 0,
  board_under30_pct               float8      not null default 0,
  board_30to50_pct                float8      not null default 0,
  board_over50_pct                float8      not null default 0,

  -- Anti-corruption
  anticorrupt_training_coverage   float8      not null default 0,
  corruption_risk_assessment_pct  float8      not null default 0,
  confirmed_corruption_incidents  int         not null default 0,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create or replace trigger hr_updated_at
  before update on public.module_hr_diversity
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- MODULE F: module_climate_finance  (org-level, IFRS S2)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.module_climate_finance (
  id                          uuid        default gen_random_uuid() primary key,
  organisation_id             uuid        not null references public.organisations(id),
  reporting_year              text        not null default '2025',
  unique (organisation_id, reporting_year),

  -- Climate risks & opportunities
  climate_transition_risk_rm  float8      not null default 0,
  climate_transition_risk_pct float8      not null default 0,
  climate_physical_risk_rm    float8      not null default 0,
  climate_physical_risk_pct   float8      not null default 0,
  climate_chronic_risk_rm     float8      not null default 0,
  climate_chronic_risk_pct    float8      not null default 0,
  climate_opportunities_rm    float8      not null default 0,
  climate_opportunities_pct   float8      not null default 0,

  -- Capital & pricing
  climate_capex_rm            float8      not null default 0,
  internal_carbon_price       float8      not null default 0,
  exec_climate_remun_pct      float8      not null default 0,

  -- Financial position impact
  fin_position_impact_rm      float8      not null default 0,
  fin_position_impact_pct     float8      not null default 0,
  fin_position_time_horizon   text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create or replace trigger climate_updated_at
  before update on public.module_climate_finance
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- EVENT FINANCIALS  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.event_financials (
  id                      uuid    default gen_random_uuid() primary key,
  event_id                uuid    not null unique references public.events(id) on delete cascade,

  budget_estimated        float8  not null default 0,
  budget_actual           float8  not null default 0,
  budget_variance         float8  generated always as (budget_estimated - budget_actual) stored,
  budget_utilisation_pct  float8  generated always as (
    case when budget_estimated > 0
    then round((budget_actual / budget_estimated * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  revenue_estimated       float8  not null default 0,
  revenue_actual          float8  not null default 0,
  revenue_variance        float8  generated always as (revenue_actual - revenue_estimated) stored,
  net_profit              float8  generated always as (revenue_actual - budget_actual) stored,
  roi_pct                 float8  generated always as (
    case when budget_actual > 0
    then round(((revenue_actual - budget_actual) / budget_actual * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  green_spend_rm          float8  not null default 0,
  green_spend_ratio_pct   float8  generated always as (
    case when budget_actual > 0
    then round((green_spend_rm / budget_actual * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create or replace trigger financials_updated_at
  before update on public.event_financials
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- EVENT TIMELINE  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.event_timeline (
  id                      uuid    default gen_random_uuid() primary key,
  event_id                uuid    not null unique references public.events(id) on delete cascade,

  project_start_date      date,
  planned_end_date        date,
  actual_end_date         date,
  schedule_variance_days  int     generated always as (
    case when actual_end_date is not null and planned_end_date is not null
    then (planned_end_date - actual_end_date)::int
    else null end
  ) stored,

  tasks_total             int     not null default 0,
  tasks_on_time           int     not null default 0,
  on_time_delivery_pct    float8  generated always as (
    case when tasks_total > 0
    then round((tasks_on_time::float8 / tasks_total * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  team_size               int     not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create or replace trigger timeline_updated_at
  before update on public.event_timeline
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- EVENT ATTENDANCE  (per event)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.event_attendance (
  id                   uuid    default gen_random_uuid() primary key,
  event_id             uuid    not null unique references public.events(id) on delete cascade,

  expected_attendance  int     not null default 0,
  actual_attendance    int     not null default 0,
  attendance_rate_pct  float8  generated always as (
    case when expected_attendance > 0
    then round((actual_attendance::float8 / expected_attendance * 100)::numeric, 2)::float8
    else 0.0 end
  ) stored,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create or replace trigger attendance_updated_at
  before update on public.event_attendance
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- SDG ACHIEVEMENTS  (org or event level)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.sdg_achievements (
  id                uuid        default gen_random_uuid() primary key,
  organisation_id   uuid        references public.organisations(id),
  event_id          uuid        references public.events(id) on delete set null,
  reporting_year    text        not null default '2025',
  sdg_number        int         not null check (sdg_number between 1 and 17),
  sdg_target        text,
  sdg_indicator     text,
  trigger_metric    text,
  is_achieved       boolean     not null default false,
  achievement_notes text,
  evaluated_at      timestamptz default now(),
  created_at        timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- APP SETTINGS  (singleton JSONB config)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.app_settings (
  id         uuid        default gen_random_uuid() primary key,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- VIEW: events_flat
-- Joins all module tables back into a flat projection
-- compatible with the existing React application queries.
-- ═══════════════════════════════════════════════════════════════════
create or replace view public.events_flat as
select
  e.id,
  e.event_name,
  e.client_name,
  e.event_location,
  e.event_type,
  e.event_status,
  e.reporting_year,
  e.event_start_date,
  e.event_end_date,
  e.description,
  e.organisation_id,
  e.created_at,
  e.updated_at,

  -- Module A — Green Ops
  coalesce(g.total_energy_mwh,          0)               as total_energy_mwh,
  coalesce(g.renewable_energy_mwh,       0)               as renewable_energy_mwh,
  coalesce(g.renewable_energy_pct,       0)               as renewable_energy_pct,
  coalesce(g.total_water_m3,             0)               as total_water_m3,
  coalesce(g.hazardous_waste_tonnes * 1000, 0)            as waste_hazardous_kg,
  coalesce(g.nonhazardous_waste_tonnes * 1000, 0)         as waste_nonhazardous_kg,
  coalesce(g.waste_diverted_tonnes * 1000, 0)             as waste_recycled_kg,
  0::float8                                               as waste_composted_kg,
  0::float8                                               as waste_upcycled_kg,
  coalesce(g.waste_diversion_pct,        0)               as waste_diverted_pct,
  coalesce(g.sustainable_catering_pct,   0)               as sustainable_catering_pct,
  coalesce(g.surplus_food_recovered_kg,  0)               as food_recovery_kg,
  coalesce(g.ghg_scope1_tco2e,           0)               as scope1_tco2e,
  coalesce(g.ghg_scope2_tco2e,           0)               as scope2_lb_tco2e,
  coalesce(g.ghg_scope3_tco2e,           0)               as scope3_tco2e,

  -- Module B — Health & Safety Labour
  coalesce(h.work_related_fatalities,    0)               as fatalities_count,
  coalesce(h.lti_count,                  0)               as lti_count,
  coalesce(h.total_hours_worked,         0)               as man_hours_actual,
  coalesce(h.ltir,                       0)               as ltir,
  coalesce(h.safety_training_headcount,  0)               as safety_trained_count,
  greatest(0, coalesce(h.total_headcount,0) - coalesce(h.contract_temp_count,0)) as staff_permanent_count,
  coalesce(h.contract_temp_count,        0)               as staff_contractor_count,
  coalesce(h.contract_temp_ratio_pct,    0)               as contractor_pct,
  coalesce(h.human_rights_complaints,    0)               as hr_complaints_count,
  coalesce(h.training_hours_total,       0)               as training_hours_total,
  coalesce(h.employee_turnover_count,    0)               as turnover_count,
  0::int                                                  as crew_female_count,
  0::int                                                  as crew_male_count,
  coalesce(h.total_headcount,            0)               as total_headcount,

  -- Module C — Procurement & Community
  coalesce(p.total_procurement_spend_rm, 0)               as procurement_total_rm,
  coalesce(p.local_supplier_spend_rm,    0)               as local_supplier_spend_rm,
  coalesce(p.local_supplier_spend_pct,   0)               as local_supplier_spend_pct,
  coalesce(p.community_investment_rm,    0)               as community_invest_rm,
  coalesce(p.community_beneficiaries,    0)               as community_beneficiaries,
  coalesce(p.privacy_breaches_count,     0)               as data_breach_complaints,

  -- Event Financials
  coalesce(f.budget_estimated,           0)               as budget_estimated,
  coalesce(f.budget_actual,              0)               as budget_actual,
  coalesce(f.revenue_estimated,          0)               as revenue_estimated,
  coalesce(f.revenue_actual,             0)               as revenue_actual,
  coalesce(f.green_spend_rm,             0)               as green_spend_rm,

  -- Event Timeline
  t.project_start_date,
  t.planned_end_date                                      as project_end_planned,
  coalesce(t.team_size,                  0)               as team_size_total,

  -- Event Attendance
  coalesce(a.expected_attendance,        0)               as expected_attendance,
  coalesce(a.actual_attendance,          0)               as actual_attendance

from public.events e
left join public.module_green_ops            g on g.event_id = e.id
left join public.module_health_safety_labour h on h.event_id = e.id
left join public.module_procurement_community p on p.event_id = e.id
left join public.event_financials            f on f.event_id = e.id
left join public.event_timeline              t on t.event_id = e.id
left join public.event_attendance            a on a.event_id = e.id
where e.deleted_at is null;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (open prototype policies)
-- ═══════════════════════════════════════════════════════════════════
alter table public.organisations              enable row level security;
alter table public.events                     enable row level security;
alter table public.event_team_members         enable row level security;
alter table public.module_green_ops           enable row level security;
alter table public.module_health_safety_labour enable row level security;
alter table public.module_procurement_community enable row level security;
alter table public.module_strategy_risk       enable row level security;
alter table public.module_hr_diversity        enable row level security;
alter table public.module_climate_finance     enable row level security;
alter table public.event_financials           enable row level security;
alter table public.event_timeline             enable row level security;
alter table public.event_attendance           enable row level security;
alter table public.sdg_achievements           enable row level security;
alter table public.app_settings               enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organisations','events','event_team_members',
    'module_green_ops','module_health_safety_labour','module_procurement_community',
    'module_strategy_risk','module_hr_diversity','module_climate_finance',
    'event_financials','event_timeline','event_attendance',
    'sdg_achievements','app_settings'
  ] loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'anon_all'
    ) then
      execute format(
        'create policy anon_all on public.%I for all to anon using (true) with check (true)', t
      );
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- SEED: singleton rows (skipped if already present)
-- ═══════════════════════════════════════════════════════════════════
insert into public.organisations (id, name, industry_sector)
select '00000000-0000-0000-0000-000000000001'::uuid,
       'Green Generation Events Sdn Bhd',
       'Event Management & Sustainability'
where not exists (select 1 from public.organisations);

insert into public.app_settings (data)
select '{
  "grid_emission_factor": 0.694,
  "carbon_price_rm": 12,
  "reporting_year": "2025",
  "reporting_frameworks": ["bursa", "ifrs_s1", "ifrs_s2"]
}'::jsonb
where not exists (select 1 from public.app_settings);

insert into public.module_strategy_risk (organisation_id, reporting_year)
select '00000000-0000-0000-0000-000000000001'::uuid, '2025'
where not exists (select 1 from public.module_strategy_risk);

insert into public.module_hr_diversity (organisation_id, reporting_year)
select '00000000-0000-0000-0000-000000000001'::uuid, '2025'
where not exists (select 1 from public.module_hr_diversity);

insert into public.module_climate_finance (organisation_id, reporting_year)
select '00000000-0000-0000-0000-000000000001'::uuid, '2025'
where not exists (select 1 from public.module_climate_finance);


-- ====== SEED DATA ======

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
