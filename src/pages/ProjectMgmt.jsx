import { useState, useEffect } from 'react';
import { getEventsFull } from '../utils/db';
import { Briefcase, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import './ProjectMgmt.css';

const ProjectMgmt = ({ eventId }) => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  useEffect(() => {
    const load = async () => {
      const loaded = await getEventsFull();
      setEvents(loaded);
      if (loaded.length > 0) setSelectedEventId(eventId || loaded[0].id);
    };
    load();
  }, [eventId]);

  const event = events.find(e => e.id === selectedEventId) || {};

  const budgetVariance = (event.budget_estimated || 0) - (event.budget_actual || 0);
  const budgetUtilisation = event.budget_estimated ? ((event.budget_actual || 0) / event.budget_estimated) * 100 : 0;
  
  const revenueVariance = (event.revenue_actual || 0) - (event.revenue_estimated || 0);
  const netProfit = (event.revenue_actual || 0) - (event.budget_actual || 0);
  const roi = event.budget_actual ? (netProfit / event.budget_actual) * 100 : 0;

  return (
    <div className={`pm-container ${!eventId ? 'animate-fade-in' : ''}`}>
      {!eventId && (
        <div className="page-header">
          <div>
            <h2>Project Management</h2>
            <p className="text-secondary">Budget, timeline, milestones, and risk register per event.</p>
          </div>
          <div className="header-actions">
            <select className="input-field" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              {events.map(e => <option key={e.id} value={e.id}>{e.event_name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="pm-grid">
        {/* Financial Tracking */}
        <div className="glass-card pm-section">
          <h3>6.1 Financial Tracking</h3>
          <div className="financial-stats">
            <div className="stat-box">
              <span className="stat-label">Estimated Budget</span>
              <span className="stat-value">RM {(event.budget_estimated || 0).toLocaleString()}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Actual Cost</span>
              <span className="stat-value text-danger">RM {(event.budget_actual || 0).toLocaleString()}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Budget Variance</span>
              <span className={`stat-value ${budgetVariance >= 0 ? 'text-success' : 'text-danger'}`}>
                {budgetVariance >= 0 ? '+' : '-'} RM {Math.abs(budgetVariance).toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="progress-bar-container mt-4">
            <div className="progress-header">
              <span className="text-secondary font-medium text-sm">Budget Utilisation</span>
              <span className="font-bold">{budgetUtilisation.toFixed(1)}%</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${budgetUtilisation > 100 ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${Math.min(budgetUtilisation, 100)}%` }}></div>
            </div>
          </div>

          <div className="financial-stats mt-4">
            <div className="stat-box">
              <span className="stat-label">Net Profit</span>
              <span className={`stat-value ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                RM {netProfit.toLocaleString()}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">ROI</span>
              <span className="stat-value">{roi.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline & Resources */}
        <div className="glass-card pm-section">
          <h3>6.2 Timeline & Resources</h3>
          <div className="timeline-info">
            <div className="timeline-item">
              <Clock size={16} className="text-secondary" />
              <div>
                <span className="text-sm text-secondary block">Start Date</span>
                <span className="font-medium">{event.project_start_date || 'Not set'}</span>
              </div>
            </div>
            <div className="timeline-item">
              <CheckCircle size={16} className="text-success" />
              <div>
                <span className="text-sm text-secondary block">Planned End Date</span>
                <span className="font-medium">{event.project_end_planned || 'Not set'}</span>
              </div>
            </div>
          </div>

          <hr className="divider my-4" />
          
          <div className="resource-stats">
            <div className="stat-box">
              <span className="stat-label">Team Size</span>
              <span className="stat-value">{event.team_size_total || 0}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Planned Hours</span>
              <span className="stat-value">{event.man_hours_planned || 0}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Actual Hours</span>
              <span className="stat-value">{event.man_hours_actual || 0}</span>
            </div>
          </div>
        </div>

        {/* Risk Register Placeholder */}
        <div className="glass-card pm-section" style={{ gridColumn: '1 / -1' }}>
          <div className="flex justify-between items-center mb-4">
            <h3>6.6 Risk Register</h3>
            <button className="btn btn-primary btn-sm">Add Risk</button>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk Name</th>
                  <th>Category</th>
                  <th>Likelihood</th>
                  <th>Impact</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sudden change in venue regulations</td>
                  <td>Regulatory</td>
                  <td>2</td>
                  <td>4</td>
                  <td><span className="badge badge-warning">8 (Medium)</span></td>
                  <td>Open</td>
                </tr>
                <tr>
                  <td>Supplier unable to provide eco-packaging</td>
                  <td>Operational</td>
                  <td>3</td>
                  <td>3</td>
                  <td><span className="badge badge-warning">9 (Medium)</span></td>
                  <td>Mitigated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMgmt;
