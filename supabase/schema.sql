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
