const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper to construct headers with the current JWT token
const getHeaders = async (isGet = false) => {
  const token = localStorage.getItem('token');
  
  const headers: Record<string, string> = {};
  if (!isGet) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/** Wraps fetch with centralized 401 handling. Without this, an expired or
 * invalid token left every API call failing silently (console-only errors),
 * with the UI stuck showing an empty/broken page and no indication why. */
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('token');
    sessionStorage.setItem('auth_message', 'Your session has expired. Please log in again.');
    window.location.href = '/';
    throw new Error('Unauthorized — redirecting to login.');
  }
  return res;
};

export const getEvents = async () => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/events`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getEvents error:', error);
    return [];
  }
};

export const getEventsFull = async () => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/events/full`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getEventsFull error:', error);
    return [];
  }
};

export const getEventDetail = async (id: string) => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/events/${id}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getEventDetail error:', error);
    return null;
  }
};

export const saveEvent = async (eventData: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveEvent error:', error);
    return null;
  }
};

export const deleteEvent = async (id: string) => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/events/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('deleteEvent error:', error);
  }
};

export const saveGreenOps = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/green-ops`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveGreenOps error:', error);
  }
};

export const saveHealthSafety = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/health-safety`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveHealthSafety error:', error);
  }
};

export const saveProcurement = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/procurement`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveProcurement error:', error);
  }
};

export const saveEventFinancials = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/financials`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveEventFinancials error:', error);
  }
};

export const saveEventTimeline = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/timeline`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveEventTimeline error:', error);
  }
};

export const saveEventAttendance = async (eventId: string, flat: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/events/${eventId}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(flat),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveEventAttendance error:', error);
  }
};

export const getGovernanceYears = async (): Promise<string[]> => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/governance/years`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getGovernanceYears error:', error);
    return [];
  }
};

export const getCorporateGovernance = async (year = '2025') => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/governance?year=${year}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getCorporateGovernance error:', error);
    return {};
  }
};

export const saveCorporateGovernance = async (govData: any, year = '2025'): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/governance?year=${year}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(govData),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `HTTP error! status: ${res.status}` };
    return { success: true };
  } catch (error: any) {
    console.error('saveCorporateGovernance error:', error);
    return { success: false, error: error.message || 'Failed to save.' };
  }
};

export const getSettings = async () => {
  try {
    const headers = await getHeaders(true);
    const res = await apiFetch(`${API_URL}/api/settings`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('getSettings error:', error);
    return {};
  }
};

export const saveSettings = async (settingsData: any) => {
  try {
    const headers = await getHeaders();
    const res = await apiFetch(`${API_URL}/api/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(settingsData),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('saveSettings error:', error);
  }
};

export const seedDatabase = () => {
  console.log('Using backend REST API for database queries.');
};

// ── CSV metric field definitions (editable columns only) ──────────
// Each entry: { key: flat-field-key, label: human-readable label, module: section name }
export const CSV_FIELDS = [
  // Green Ops
  { key: 'total_energy_mwh',         label: 'Energy Consumption (MWh)',              module: 'Green Ops' },
  { key: 'renewable_energy_mwh',     label: 'Renewable Energy (MWh)',                module: 'Green Ops' },
  { key: 'total_water_m3',           label: 'Water Consumption (m³)',                module: 'Green Ops' },
  { key: 'waste_hazardous_kg',       label: 'Hazardous Waste (kg)',                  module: 'Green Ops' },
  { key: 'waste_nonhazardous_kg',    label: 'Non-Hazardous Waste (kg)',              module: 'Green Ops' },
  { key: 'waste_recycled_kg',        label: 'Waste Diverted/Recycled (kg)',          module: 'Green Ops' },
  { key: 'sustainable_catering_pct', label: 'Sustainable Catering Rate (%)',         module: 'Green Ops' },
  { key: 'food_recovery_kg',         label: 'Surplus Food Recovery (kg)',            module: 'Green Ops' },
  { key: 'scope1_tco2e',             label: 'Scope 1 Emissions (tCO2e)',             module: 'Green Ops' },
  { key: 'scope2_lb_tco2e',          label: 'Scope 2 Emissions (tCO2e)',             module: 'Green Ops' },
  { key: 'scope3_tco2e',             label: 'Scope 3 Emissions (tCO2e)',             module: 'Green Ops' },
  // Health, Safety & Labour
  { key: 'fatalities_count',         label: 'Work-Related Fatalities',               module: 'Health, Safety & Labour' },
  { key: 'lti_count',                label: 'Lost Time Injuries (LTI)',              module: 'Health, Safety & Labour' },
  { key: 'man_hours_actual',         label: 'Total Hours Worked',                    module: 'Health, Safety & Labour' },
  { key: 'safety_trained_count',     label: 'Safety Training Headcount',             module: 'Health, Safety & Labour' },
  { key: 'total_headcount',          label: 'Total Headcount (all staff)',           module: 'Health, Safety & Labour' },
  { key: 'staff_contractor_count',   label: 'Contract & Temp Staff Count',          module: 'Health, Safety & Labour' },
  { key: 'hr_complaints_count',      label: 'Human Rights Complaints',               module: 'Health, Safety & Labour' },
  { key: 'training_hours_total',     label: 'Employee Training Hours',               module: 'Health, Safety & Labour' },
  { key: 'turnover_count',           label: 'Employee Turnover Headcount',           module: 'Health, Safety & Labour' },
  // Procurement & Community
  { key: 'procurement_total_rm',     label: 'Total Procurement Spend (RM)',          module: 'Procurement & Community' },
  { key: 'local_supplier_spend_rm',  label: 'Local Supplier Spend (RM)',             module: 'Procurement & Community' },
  { key: 'community_invest_rm',      label: 'Community Investment (RM)',             module: 'Procurement & Community' },
  { key: 'community_beneficiaries',  label: 'Community Beneficiaries',               module: 'Procurement & Community' },
  { key: 'data_breach_complaints',   label: 'Privacy Breaches (count)',              module: 'Procurement & Community' },
  // Financial
  { key: 'budget_estimated',         label: 'Estimated Budget (RM)',                 module: 'Financial' },
  { key: 'budget_actual',            label: 'Actual Cost (RM)',                      module: 'Financial' },
  { key: 'revenue_estimated',        label: 'Estimated Revenue (RM)',                module: 'Financial' },
  { key: 'revenue_actual',           label: 'Actual Revenue (RM)',                   module: 'Financial' },
  { key: 'green_spend_rm',           label: 'Green Spend (RM)',                      module: 'Financial' },
  // Timeline & Team
  { key: 'project_start_date',       label: 'Project Start Date (YYYY-MM-DD)',       module: 'Timeline & Team' },
  { key: 'project_end_planned',      label: 'Planned End Date (YYYY-MM-DD)',         module: 'Timeline & Team' },
  { key: 'timeline_actual_end_date', label: 'Actual End Date (YYYY-MM-DD)',          module: 'Timeline & Team' },
  { key: 'tasks_total',              label: 'Total Tasks',                           module: 'Timeline & Team' },
  { key: 'tasks_on_time',            label: 'Tasks Completed On Time',              module: 'Timeline & Team' },
  { key: 'team_size_total',          label: 'Total Team Size',                       module: 'Timeline & Team' },
  // Attendance
  { key: 'expected_attendance',      label: 'Expected Attendance',                   module: 'Attendance' },
  { key: 'actual_attendance',        label: 'Actual Attendance',                     module: 'Attendance' },
];

/**
 * Build a CSV string from flat event data and trigger a browser download.
 * Format: Module, Metric, Value  (one row per metric field)
 */
export const downloadEventCsv = (event: any) => {
  const header = 'Module,Metric,Value\n';
  const rows = CSV_FIELDS.map(({ key, label, module }) => {
    const raw = event[key] ?? '';
    // Escape commas and quotes inside values
    const val = String(raw).replace(/"/g, '""');
    return `"${module}","${label}","${val}"`;
  });

  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (event.event_name || 'event').replace(/[^a-z0-9_\-]/gi, '_');
  link.href = url;
  link.download = `${safeName}_metrics.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parse an uploaded CSV file (same format as downloadEventCsv output),
 * map values back to field keys, and POST to the bulk-update endpoint.
 */
export const uploadEventCsv = async (eventId: string, file: File): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);

        // RFC-4180 compliant CSV field splitter
        const splitCsvLine = (line: string): string[] => {
          const fields: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci];
            if (inQuotes) {
              if (ch === '"' && line[ci + 1] === '"') { current += '"'; ci++; }
              else if (ch === '"') { inQuotes = false; }
              else { current += ch; }
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === ',') { fields.push(current); current = ''; }
              else { current += ch; }
            }
          }
          fields.push(current);
          return fields;
        };

        // Build label → key lookup
        const labelToKey: Record<string, string> = {};
        CSV_FIELDS.forEach(({ key, label }) => { labelToKey[label] = key; });

        const flat: Record<string, any> = {};

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // fields: [Module, Metric, Value]
          const fields = splitCsvLine(line);
          if (fields.length < 3) continue;

          const metricLabel = fields[1].trim();
          const value = fields[2].trim();

          const fieldKey = labelToKey[metricLabel];
          if (fieldKey) {
            flat[fieldKey] = value;
          }
        }

        const headers = await getHeaders();
        const res = await apiFetch(`${API_URL}/api/events/${eventId}/bulk-update`, {
          method: 'POST',
          headers,
          body: JSON.stringify(flat),
        });

        // Guard against non-JSON responses (e.g. HTML error pages)
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          resolve({ success: false, error: `Server error (HTTP ${res.status}). Make sure the backend is running.` });
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          resolve({ success: false, error: data.error || 'Upload failed.' });
        } else {
          resolve({ success: true });
        }
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'Failed to parse CSV.' });
      }
    };
    reader.readAsText(file);
  });
};

