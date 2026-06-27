// ═══════════════════════════════════════════════════════════════
//  reseed_events.js  — wipe & reseed event data across 2024-2026
//  Run: node scripts/reseed_events.js
// ═══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const EVENTS = [
  { id: 'e0000000-0000-0000-0000-000000000001', event_name: 'Green Building Expo 2024', client_name: 'MRCB Quill REIT', event_location: 'MITEC, Kepong, Kuala Lumpur', event_type: 'exhibition', event_status: 'Completed', reporting_year: '2024', event_start_date: '2024-03-14', event_end_date: '2024-03-16', description: 'Annual exhibition showcasing green building materials, sustainable architecture and energy-efficient technologies.' },
  { id: 'e0000000-0000-0000-0000-000000000002', event_name: 'ESG Investor Forum 2024', client_name: 'CIMB Group Holdings', event_location: 'Menara CIMB, Kuala Lumpur', event_type: 'forum', event_status: 'Completed', reporting_year: '2024', event_start_date: '2024-06-04', event_end_date: '2024-06-05', description: 'Two-day forum connecting institutional investors with ESG-aligned companies and sustainable finance panels.' },
  { id: 'e0000000-0000-0000-0000-000000000003', event_name: 'Climate Action Week 2024', client_name: 'Petronas', event_location: 'KLCC Park, Kuala Lumpur', event_type: 'campaign', event_status: 'Completed', reporting_year: '2024', event_start_date: '2024-09-23', event_end_date: '2024-09-27', description: 'Week-long public awareness campaign aligned with UN Climate Week featuring community clean-up and carbon literacy workshops.' },
  { id: 'e0000000-0000-0000-0000-000000000004', event_name: 'Sustainability Leadership Summit 2024', client_name: 'Bursa Malaysia', event_location: 'Shangri-La Hotel, Kuala Lumpur', event_type: 'conference', event_status: 'Completed', reporting_year: '2024', event_start_date: '2024-11-06', event_end_date: '2024-11-07', description: 'High-level C-suite conference on integrating ESG into corporate strategy with global sustainability leaders.' },
  { id: 'e0000000-0000-0000-0000-000000000005', event_name: 'Green Tech Summit 2025', client_name: 'Axiata Group Berhad', event_location: 'KLCC Convention Centre, Kuala Lumpur', event_type: 'conference', event_status: 'Completed', reporting_year: '2025', event_start_date: '2025-02-18', event_end_date: '2025-02-20', description: 'Premier technology conference focusing on green ICT and renewable energy integration across ASEAN.' },
  { id: 'e0000000-0000-0000-0000-000000000006', event_name: 'Sustainability Forum ASEAN 2025', client_name: 'CIMB Group Holdings', event_location: 'Grand Hyatt, Kuala Lumpur', event_type: 'forum', event_status: 'Completed', reporting_year: '2025', event_start_date: '2025-04-22', event_end_date: '2025-04-24', description: 'Regional sustainability forum aligning ESG priorities across ASEAN member states.' },
  { id: 'e0000000-0000-0000-0000-000000000007', event_name: 'Zero Waste Festival 2025', client_name: 'Sunway Group', event_location: 'Sunway Pyramid, Petaling Jaya', event_type: 'campaign', event_status: 'Completed', reporting_year: '2025', event_start_date: '2025-06-05', event_end_date: '2025-06-08', description: 'Public festival on World Environment Day promoting circular economy and zero-waste lifestyle.' },
  { id: 'e0000000-0000-0000-0000-000000000008', event_name: 'ESG Leadership Conference 2025', client_name: 'Bursa Malaysia', event_location: 'Mandarin Oriental, Kuala Lumpur', event_type: 'conference', event_status: 'Active', reporting_year: '2025', event_start_date: '2025-09-10', event_end_date: '2025-09-11', description: 'Annual flagship conference on ESG disclosure frameworks and mandatory reporting for Bursa Malaysia PLCs.' },
  { id: 'e0000000-0000-0000-0000-000000000009', event_name: 'Renewable Energy Expo Malaysia 2025', client_name: 'Tenaga Nasional Berhad', event_location: 'PWTC, Kuala Lumpur', event_type: 'exhibition', event_status: 'Planned', reporting_year: '2025', event_start_date: '2025-11-18', event_end_date: '2025-11-20', description: 'National expo showcasing solar, wind, hydro and bioenergy solutions connecting developers with buyers.' },
  { id: 'e0000000-0000-0000-0000-000000000010', event_name: 'ASEAN Green Finance Summit 2026', client_name: 'Maybank Group', event_location: 'Menara Maybank, Kuala Lumpur', event_type: 'forum', event_status: 'Active', reporting_year: '2026', event_start_date: '2026-02-10', event_end_date: '2026-02-12', description: 'Summit on sustainable finance instruments including green bonds and sustainability-linked loans for Southeast Asian markets.' },
  { id: 'e0000000-0000-0000-0000-000000000011', event_name: 'Corporate ESG Awards Gala 2026', client_name: 'PwC Malaysia', event_location: 'The RuMa Hotel, Kuala Lumpur', event_type: 'gala', event_status: 'Planned', reporting_year: '2026', event_start_date: '2026-04-30', event_end_date: '2026-04-30', description: 'Annual awards ceremony recognising outstanding ESG performance across twelve Malaysian industry categories.' },
  { id: 'e0000000-0000-0000-0000-000000000012', event_name: 'Net Zero Malaysia Conference 2026', client_name: 'Ministry of Natural Resources & Environmental Sustainability', event_location: 'PICC, Putrajaya', event_type: 'conference', event_status: 'Planned', reporting_year: '2026', event_start_date: '2026-07-14', event_end_date: '2026-07-16', description: 'National conference reviewing Malaysia net-zero 2050 progress with ministerial keynotes and decarbonisation workshops.' },
];

const GREEN_OPS = {
  'e0000000-0000-0000-0000-000000000001': { total_energy_mwh: 71.2, renewable_energy_mwh: 9.8,  total_water_m3: 195.0, hazardous_waste_tonnes: 0.068, nonhazardous_waste_tonnes: 0.570, waste_diverted_tonnes: 0.520, sustainable_catering_pct: 48.0, surplus_food_recovered_kg: 62.0, ghg_scope1_tco2e: 4.2, ghg_scope2_tco2e: 12.6, ghg_scope3_tco2e: 29.4 },
  'e0000000-0000-0000-0000-000000000002': { total_energy_mwh: 28.4, renewable_energy_mwh: 8.1,  total_water_m3:  78.0, hazardous_waste_tonnes: 0.022, nonhazardous_waste_tonnes: 0.180, waste_diverted_tonnes: 0.175, sustainable_catering_pct: 62.0, surplus_food_recovered_kg: 24.0, ghg_scope1_tco2e: 1.7, ghg_scope2_tco2e:  4.9, ghg_scope3_tco2e: 11.5 },
  'e0000000-0000-0000-0000-000000000003': { total_energy_mwh: 92.6, renewable_energy_mwh: 28.5, total_water_m3: 260.0, hazardous_waste_tonnes: 0.085, nonhazardous_waste_tonnes: 0.710, waste_diverted_tonnes: 0.680, sustainable_catering_pct: 78.0, surplus_food_recovered_kg: 84.0, ghg_scope1_tco2e: 5.5, ghg_scope2_tco2e: 16.2, ghg_scope3_tco2e: 37.8 },
  'e0000000-0000-0000-0000-000000000004': { total_energy_mwh: 35.8, renewable_energy_mwh: 12.4, total_water_m3:  98.0, hazardous_waste_tonnes: 0.030, nonhazardous_waste_tonnes: 0.245, waste_diverted_tonnes: 0.240, sustainable_catering_pct: 70.0, surplus_food_recovered_kg: 32.0, ghg_scope1_tco2e: 2.1, ghg_scope2_tco2e:  6.3, ghg_scope3_tco2e: 14.7 },
  'e0000000-0000-0000-0000-000000000005': { total_energy_mwh: 52.4, renewable_energy_mwh: 17.8, total_water_m3: 138.0, hazardous_waste_tonnes: 0.048, nonhazardous_waste_tonnes: 0.395, waste_diverted_tonnes: 0.385, sustainable_catering_pct: 65.0, surplus_food_recovered_kg: 46.0, ghg_scope1_tco2e: 3.1, ghg_scope2_tco2e:  9.3, ghg_scope3_tco2e: 21.6 },
  'e0000000-0000-0000-0000-000000000006': { total_energy_mwh: 44.1, renewable_energy_mwh: 16.2, total_water_m3: 115.0, hazardous_waste_tonnes: 0.038, nonhazardous_waste_tonnes: 0.315, waste_diverted_tonnes: 0.300, sustainable_catering_pct: 72.0, surplus_food_recovered_kg: 38.0, ghg_scope1_tco2e: 2.6, ghg_scope2_tco2e:  7.8, ghg_scope3_tco2e: 18.2 },
  'e0000000-0000-0000-0000-000000000007': { total_energy_mwh: 18.5, renewable_energy_mwh:  9.6, total_water_m3:  52.0, hazardous_waste_tonnes: 0.010, nonhazardous_waste_tonnes: 0.085, waste_diverted_tonnes: 0.082, sustainable_catering_pct: 95.0, surplus_food_recovered_kg: 18.0, ghg_scope1_tco2e: 1.1, ghg_scope2_tco2e:  3.3, ghg_scope3_tco2e:  7.7 },
  'e0000000-0000-0000-0000-000000000008': { total_energy_mwh: 22.0, renewable_energy_mwh:  7.5, total_water_m3:  62.0, hazardous_waste_tonnes: 0.018, nonhazardous_waste_tonnes: 0.148, waste_diverted_tonnes: 0.140, sustainable_catering_pct: 68.0, surplus_food_recovered_kg: 21.0, ghg_scope1_tco2e: 1.3, ghg_scope2_tco2e:  3.9, ghg_scope3_tco2e:  9.1 },
  'e0000000-0000-0000-0000-000000000009': { total_energy_mwh: 58.3, renewable_energy_mwh: 22.6, total_water_m3: 155.0, hazardous_waste_tonnes: 0.052, nonhazardous_waste_tonnes: 0.430, waste_diverted_tonnes: 0.420, sustainable_catering_pct: 60.0, surplus_food_recovered_kg: 50.0, ghg_scope1_tco2e: 3.5, ghg_scope2_tco2e: 10.4, ghg_scope3_tco2e: 24.2 },
  'e0000000-0000-0000-0000-000000000010': { total_energy_mwh: 31.6, renewable_energy_mwh: 12.8, total_water_m3:  85.0, hazardous_waste_tonnes: 0.026, nonhazardous_waste_tonnes: 0.215, waste_diverted_tonnes: 0.210, sustainable_catering_pct: 75.0, surplus_food_recovered_kg: 28.0, ghg_scope1_tco2e: 1.9, ghg_scope2_tco2e:  5.7, ghg_scope3_tco2e: 13.2 },
  'e0000000-0000-0000-0000-000000000011': { total_energy_mwh:  8.2, renewable_energy_mwh:  3.4, total_water_m3:  22.0, hazardous_waste_tonnes: 0.005, nonhazardous_waste_tonnes: 0.042, waste_diverted_tonnes: 0.040, sustainable_catering_pct: 85.0, surplus_food_recovered_kg:  8.0, ghg_scope1_tco2e: 0.5, ghg_scope2_tco2e:  1.5, ghg_scope3_tco2e:  3.4 },
  'e0000000-0000-0000-0000-000000000012': { total_energy_mwh: 42.8, renewable_energy_mwh: 18.4, total_water_m3: 118.0, hazardous_waste_tonnes: 0.036, nonhazardous_waste_tonnes: 0.300, waste_diverted_tonnes: 0.290, sustainable_catering_pct: 80.0, surplus_food_recovered_kg: 40.0, ghg_scope1_tco2e: 2.6, ghg_scope2_tco2e:  7.7, ghg_scope3_tco2e: 17.9 },
};

const HEALTH = {
  'e0000000-0000-0000-0000-000000000001': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 31200, safety_training_headcount: 430, total_headcount: 490, contract_temp_count: 115, human_rights_complaints: 0, training_hours_total: 5800, employee_turnover_count: 11 },
  'e0000000-0000-0000-0000-000000000002': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 14400, safety_training_headcount: 195, total_headcount: 230, contract_temp_count:  55, human_rights_complaints: 0, training_hours_total: 2600, employee_turnover_count:  5 },
  'e0000000-0000-0000-0000-000000000003': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 48000, safety_training_headcount: 580, total_headcount: 660, contract_temp_count: 155, human_rights_complaints: 0, training_hours_total: 8400, employee_turnover_count: 14 },
  'e0000000-0000-0000-0000-000000000004': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 17600, safety_training_headcount: 235, total_headcount: 280, contract_temp_count:  65, human_rights_complaints: 0, training_hours_total: 3200, employee_turnover_count:  6 },
  'e0000000-0000-0000-0000-000000000005': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 26400, safety_training_headcount: 355, total_headcount: 410, contract_temp_count:  95, human_rights_complaints: 0, training_hours_total: 4800, employee_turnover_count:  9 },
  'e0000000-0000-0000-0000-000000000006': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 22400, safety_training_headcount: 305, total_headcount: 360, contract_temp_count:  85, human_rights_complaints: 0, training_hours_total: 4200, employee_turnover_count:  8 },
  'e0000000-0000-0000-0000-000000000007': { work_related_fatalities: 0, lti_count: 0, total_hours_worked:  9600, safety_training_headcount: 125, total_headcount: 150, contract_temp_count:  35, human_rights_complaints: 0, training_hours_total: 1800, employee_turnover_count:  3 },
  'e0000000-0000-0000-0000-000000000008': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 12800, safety_training_headcount: 165, total_headcount: 200, contract_temp_count:  48, human_rights_complaints: 0, training_hours_total: 2400, employee_turnover_count:  4 },
  'e0000000-0000-0000-0000-000000000009': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 28800, safety_training_headcount: 385, total_headcount: 450, contract_temp_count: 105, human_rights_complaints: 0, training_hours_total: 5200, employee_turnover_count: 10 },
  'e0000000-0000-0000-0000-000000000010': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 16000, safety_training_headcount: 215, total_headcount: 260, contract_temp_count:  62, human_rights_complaints: 0, training_hours_total: 2900, employee_turnover_count:  5 },
  'e0000000-0000-0000-0000-000000000011': { work_related_fatalities: 0, lti_count: 0, total_hours_worked:  4800, safety_training_headcount:  62, total_headcount:  75, contract_temp_count:  18, human_rights_complaints: 0, training_hours_total:  900, employee_turnover_count:  1 },
  'e0000000-0000-0000-0000-000000000012': { work_related_fatalities: 0, lti_count: 0, total_hours_worked: 20000, safety_training_headcount: 265, total_headcount: 320, contract_temp_count:  76, human_rights_complaints: 0, training_hours_total: 3600, employee_turnover_count:  7 },
};

const PROCUREMENT = {
  'e0000000-0000-0000-0000-000000000001': { total_procurement_spend_rm: 560000, local_supplier_spend_rm: 325000, community_investment_rm: 20000, community_beneficiaries: 2400, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000002': { total_procurement_spend_rm: 260000, local_supplier_spend_rm: 152000, community_investment_rm:  9000, community_beneficiaries:  750, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000003': { total_procurement_spend_rm: 720000, local_supplier_spend_rm: 432000, community_investment_rm: 28000, community_beneficiaries: 3800, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000004': { total_procurement_spend_rm: 310000, local_supplier_spend_rm: 192000, community_investment_rm: 12000, community_beneficiaries:  980, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000005': { total_procurement_spend_rm: 415000, local_supplier_spend_rm: 245000, community_investment_rm: 16000, community_beneficiaries: 1350, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000006': { total_procurement_spend_rm: 355000, local_supplier_spend_rm: 213000, community_investment_rm: 13500, community_beneficiaries: 1100, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000007': { total_procurement_spend_rm: 148000, local_supplier_spend_rm:  96000, community_investment_rm:  6500, community_beneficiaries:  520, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000008': { total_procurement_spend_rm: 195000, local_supplier_spend_rm: 118000, community_investment_rm:  8000, community_beneficiaries:  640, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000009': { total_procurement_spend_rm: 480000, local_supplier_spend_rm: 292000, community_investment_rm: 18000, community_beneficiaries: 1800, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000010': { total_procurement_spend_rm: 228000, local_supplier_spend_rm: 138000, community_investment_rm:  9500, community_beneficiaries:  780, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000011': { total_procurement_spend_rm:  92000, local_supplier_spend_rm:  58000, community_investment_rm:  3500, community_beneficiaries:  240, privacy_breaches_count: 0 },
  'e0000000-0000-0000-0000-000000000012': { total_procurement_spend_rm: 305000, local_supplier_spend_rm: 186000, community_investment_rm: 12000, community_beneficiaries:  950, privacy_breaches_count: 0 },
};

const FINANCIALS = {
  'e0000000-0000-0000-0000-000000000001': { budget_estimated: 740000, budget_actual: 718000, revenue_estimated: 920000, revenue_actual: 952000, green_spend_rm: 68000 },
  'e0000000-0000-0000-0000-000000000002': { budget_estimated: 340000, budget_actual: 328000, revenue_estimated: 420000, revenue_actual: 438000, green_spend_rm: 32000 },
  'e0000000-0000-0000-0000-000000000003': { budget_estimated: 950000, budget_actual: 924000, revenue_estimated: 1180000, revenue_actual: 1150000, green_spend_rm: 96000 },
  'e0000000-0000-0000-0000-000000000004': { budget_estimated: 420000, budget_actual: 405000, revenue_estimated: 520000, revenue_actual: 542000, green_spend_rm: 44000 },
  'e0000000-0000-0000-0000-000000000005': { budget_estimated: 560000, budget_actual: 542000, revenue_estimated: 700000, revenue_actual: 728000, green_spend_rm: 54000 },
  'e0000000-0000-0000-0000-000000000006': { budget_estimated: 480000, budget_actual: 462000, revenue_estimated: 600000, revenue_actual: 615000, green_spend_rm: 48000 },
  'e0000000-0000-0000-0000-000000000007': { budget_estimated: 195000, budget_actual: 188000, revenue_estimated: 240000, revenue_actual: 252000, green_spend_rm: 22000 },
  'e0000000-0000-0000-0000-000000000008': { budget_estimated: 258000, budget_actual:      0, revenue_estimated: 320000, revenue_actual:      0, green_spend_rm: 28000 },
  'e0000000-0000-0000-0000-000000000009': { budget_estimated: 625000, budget_actual:      0, revenue_estimated: 780000, revenue_actual:      0, green_spend_rm: 64000 },
  'e0000000-0000-0000-0000-000000000010': { budget_estimated: 310000, budget_actual: 295000, revenue_estimated: 390000, revenue_actual: 408000, green_spend_rm: 34000 },
  'e0000000-0000-0000-0000-000000000011': { budget_estimated: 120000, budget_actual:      0, revenue_estimated: 150000, revenue_actual:      0, green_spend_rm: 14000 },
  'e0000000-0000-0000-0000-000000000012': { budget_estimated: 415000, budget_actual:      0, revenue_estimated: 520000, revenue_actual:      0, green_spend_rm: 42000 },
};

const TIMELINES = {
  'e0000000-0000-0000-0000-000000000001': { project_start_date: '2023-12-01', planned_end_date: '2024-03-16', actual_end_date: '2024-03-16', tasks_total: 32, tasks_on_time: 30, team_size: 64 },
  'e0000000-0000-0000-0000-000000000002': { project_start_date: '2024-03-15', planned_end_date: '2024-06-05', actual_end_date: '2024-06-05', tasks_total: 20, tasks_on_time: 20, team_size: 30 },
  'e0000000-0000-0000-0000-000000000003': { project_start_date: '2024-07-01', planned_end_date: '2024-09-27', actual_end_date: '2024-09-29', tasks_total: 38, tasks_on_time: 34, team_size: 80 },
  'e0000000-0000-0000-0000-000000000004': { project_start_date: '2024-08-01', planned_end_date: '2024-11-07', actual_end_date: '2024-11-07', tasks_total: 24, tasks_on_time: 23, team_size: 38 },
  'e0000000-0000-0000-0000-000000000005': { project_start_date: '2024-11-15', planned_end_date: '2025-02-20', actual_end_date: '2025-02-20', tasks_total: 28, tasks_on_time: 27, team_size: 48 },
  'e0000000-0000-0000-0000-000000000006': { project_start_date: '2025-02-01', planned_end_date: '2025-04-24', actual_end_date: '2025-04-25', tasks_total: 22, tasks_on_time: 20, team_size: 40 },
  'e0000000-0000-0000-0000-000000000007': { project_start_date: '2025-04-01', planned_end_date: '2025-06-08', actual_end_date: '2025-06-08', tasks_total: 16, tasks_on_time: 16, team_size: 22 },
  'e0000000-0000-0000-0000-000000000008': { project_start_date: '2025-06-15', planned_end_date: '2025-09-11', actual_end_date: null,         tasks_total: 20, tasks_on_time:  0, team_size: 32 },
  'e0000000-0000-0000-0000-000000000009': { project_start_date: '2025-08-01', planned_end_date: '2025-11-20', actual_end_date: null,         tasks_total: 26, tasks_on_time:  0, team_size: 55 },
  'e0000000-0000-0000-0000-000000000010': { project_start_date: '2025-11-01', planned_end_date: '2026-02-12', actual_end_date: '2026-02-13', tasks_total: 22, tasks_on_time: 20, team_size: 36 },
  'e0000000-0000-0000-0000-000000000011': { project_start_date: '2026-02-15', planned_end_date: '2026-04-30', actual_end_date: null,         tasks_total: 12, tasks_on_time:  0, team_size: 14 },
  'e0000000-0000-0000-0000-000000000012': { project_start_date: '2026-04-01', planned_end_date: '2026-07-16', actual_end_date: null,         tasks_total: 30, tasks_on_time:  0, team_size: 50 },
};

const ATTENDANCE = {
  'e0000000-0000-0000-0000-000000000001': { expected_attendance: 2800, actual_attendance: 2650 },
  'e0000000-0000-0000-0000-000000000002': { expected_attendance:  900, actual_attendance:  845 },
  'e0000000-0000-0000-0000-000000000003': { expected_attendance: 4000, actual_attendance: 3820 },
  'e0000000-0000-0000-0000-000000000004': { expected_attendance:  600, actual_attendance:  572 },
  'e0000000-0000-0000-0000-000000000005': { expected_attendance: 2000, actual_attendance: 1890 },
  'e0000000-0000-0000-0000-000000000006': { expected_attendance: 1600, actual_attendance: 1520 },
  'e0000000-0000-0000-0000-000000000007': { expected_attendance: 1200, actual_attendance: 1180 },
  'e0000000-0000-0000-0000-000000000008': { expected_attendance: 1000, actual_attendance:    0 },
  'e0000000-0000-0000-0000-000000000009': { expected_attendance: 2400, actual_attendance:    0 },
  'e0000000-0000-0000-0000-000000000010': { expected_attendance:  750, actual_attendance:  718 },
  'e0000000-0000-0000-0000-000000000011': { expected_attendance:  400, actual_attendance:    0 },
  'e0000000-0000-0000-0000-000000000012': { expected_attendance: 1800, actual_attendance:    0 },
};

async function main() {
  console.log('Deleting all existing event-related data...');
  const tables = ['event_attendance','event_timeline','event_financials','module_procurement_community','module_health_safety_labour','module_green_ops','event_team_members','sdg_achievements','events'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { console.error('Error deleting ' + table + ':', error.message); } else { console.log('Cleared ' + table); }
  }
  console.log('\nSeeding 12 events across 2024 / 2025 / 2026...');
  const eventsWithOrg = EVENTS.map(e => ({ ...e, organisation_id: ORG_ID }));
  const { error: evErr } = await supabase.from('events').insert(eventsWithOrg);
  if (evErr) { console.error('events:', evErr.message); process.exit(1); }
  console.log('Inserted ' + EVENTS.length + ' events');
  const greenRows = Object.entries(GREEN_OPS).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: goErr } = await supabase.from('module_green_ops').insert(greenRows);
  if (goErr) { console.error('module_green_ops:', goErr.message); process.exit(1); }
  console.log('Inserted ' + greenRows.length + ' Green Ops records');
  const healthRows = Object.entries(HEALTH).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: hErr } = await supabase.from('module_health_safety_labour').insert(healthRows);
  if (hErr) { console.error('module_health_safety_labour:', hErr.message); process.exit(1); }
  console.log('Inserted ' + healthRows.length + ' Health & Safety records');
  const procRows = Object.entries(PROCUREMENT).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: pErr } = await supabase.from('module_procurement_community').insert(procRows);
  if (pErr) { console.error('module_procurement_community:', pErr.message); process.exit(1); }
  console.log('Inserted ' + procRows.length + ' Procurement records');
  const finRows = Object.entries(FINANCIALS).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: fErr } = await supabase.from('event_financials').insert(finRows);
  if (fErr) { console.error('event_financials:', fErr.message); process.exit(1); }
  console.log('Inserted ' + finRows.length + ' Financial records');
  const tlRows = Object.entries(TIMELINES).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: tErr } = await supabase.from('event_timeline').insert(tlRows);
  if (tErr) { console.error('event_timeline:', tErr.message); process.exit(1); }
  console.log('Inserted ' + tlRows.length + ' Timeline records');
  const attRows = Object.entries(ATTENDANCE).map(([event_id, d]) => ({ event_id, ...d }));
  const { error: aErr } = await supabase.from('event_attendance').insert(attRows);
  if (aErr) { console.error('event_attendance:', aErr.message); process.exit(1); }
  console.log('Inserted ' + attRows.length + ' Attendance records');
  console.log('\nReseed complete!');
  EVENTS.forEach(e => console.log('[' + e.reporting_year + '] ' + e.event_status.padEnd(9) + ' - ' + e.event_name));
}

main().catch(err => { console.error(err); process.exit(1); });
