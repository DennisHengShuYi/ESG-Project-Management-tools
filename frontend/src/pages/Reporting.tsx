import { useState, useEffect } from 'react';
import { getEvents } from '../utils/db';
import { FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import './Reporting.css';

const CURRENT_YEAR = new Date().getFullYear();

const Reporting = () => {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const load = async () => {
      setEvents(await getEvents());
    };
    load();
  }, []);

  /* Years actually present in event data, newest first, current year always included */
  const availableYears = Array.from(new Set([
    String(CURRENT_YEAR),
    ...events.map((e: any) => e.reporting_year).filter(Boolean),
  ])).sort((a, b) => Number(b) - Number(a));

  const currentEvents = events.filter(e => e.reporting_year === selectedYear);
  const isComplete = currentEvents.length > 0; // Simplified completeness check

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
