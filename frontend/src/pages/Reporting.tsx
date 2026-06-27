import { useState, useEffect } from 'react';
import { getEventsFull } from '../utils/db';
import { FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import { useReportingYear } from '../hooks/useReportingYear';
import './Reporting.css';

// One representative metric per Bursa Malaysia sustainability pillar this
// report aggregates (Green Ops / Health & Safety / Procurement / Financial).
// "Complete" means every pillar has *some* reported data, not just that an
// event row exists for the year — an event with everything left at 0 used to
// pass this check.
const MANDATORY_PILLAR_FIELDS = ['total_energy_mwh', 'man_hours_actual', 'procurement_total_rm', 'budget_actual'];

const Reporting = () => {
  const [events, setEvents] = useState([]);
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(events);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await getEventsFull();
      if (active) setEvents(data);
    };
    load();
    return () => { active = false; };
  }, []);

  const currentEvents = events.filter(e => e.reporting_year === selectedYear);
  const isComplete = currentEvents.length > 0
    && MANDATORY_PILLAR_FIELDS.every(field => currentEvents.some((e: any) => Number(e[field]) > 0));

  return (
    <div className="reporting-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Compliance & Reporting</h2>
          <p className="text-secondary">Generate Bursa Malaysia, IFRS S1/S2, and GRI compliance reports.</p>
        </div>
        <div className="header-actions">
          <select className="input-field" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{`FYE ${y}`}</option>)}
          </select>
        </div>
      </div>

      <div className="reporting-grid">
        <div className="glass-card report-card">
          <div className="report-icon bg-primary-light text-primary">
            <FileText size={32} />
          </div>
          <h3>Bursa Malaysia Sustainability Statement</h3>
          <p className="text-secondary">11 Common Sustainability Matters aggregated across all events.</p>
          
          <div className="completeness-check">
            {isComplete ? (
              <span className="badge badge-success"><CheckCircle size={14}/> Data Complete</span>
            ) : (
              <span className="badge badge-danger"><XCircle size={14}/> Missing Mandatory Data</span>
            )}
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary" disabled={!isComplete}><Download size={16}/> Export PDF</button>
            <button className="btn btn-secondary" disabled={!isComplete}><Download size={16}/> Export Excel (CSI)</button>
          </div>
        </div>

        <div className="glass-card report-card">
          <div className="report-icon bg-info-light text-info">
            <FileText size={32} />
          </div>
          <h3>IFRS S1 & S2 Disclosure</h3>
          <p className="text-secondary">Narrative governance plus climate metrics and scenarios.</p>
          
          <div className="completeness-check">
            <span className="badge badge-success"><CheckCircle size={14}/> Narrative Ready</span>
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary"><Download size={16}/> Export Full Package (PDF)</button>
          </div>
        </div>

        <div className="glass-card report-card">
          <div className="report-icon bg-warning-light text-warning">
            <FileText size={32} />
          </div>
          <h3>GRI Standards Report</h3>
          <p className="text-secondary">GRI Content Index mapping each metric to disclosure number.</p>
          
          <div className="completeness-check">
            <span className="badge badge-success"><CheckCircle size={14}/> 100% Coverage</span>
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary"><Download size={16}/> Export GRI Index (PDF)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reporting;
