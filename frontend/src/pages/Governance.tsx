import { useState, useEffect } from 'react';
import { getGovernanceYears, getCorporateGovernance, saveCorporateGovernance } from '../utils/db';
import { Save } from 'lucide-react';
import { useReportingYear } from '../hooks/useReportingYear';
import './Governance.css';

const Governance = () => {
  const [formData, setFormData] = useState(null);
  const [governanceYears, setGovernanceYears] = useState<string[]>([]);
  // Years are sourced from the governance tables themselves, not from
  // module_events — an event can exist for a year with no governance data
  // saved at all (and vice versa), so event-existence is the wrong signal
  // for "should the page default to this year".
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(governanceYears);

  useEffect(() => {
    getGovernanceYears().then(setGovernanceYears);
  }, []);

  useEffect(() => {
    // Guards against React.StrictMode's dev-mode double-invoke: without this,
    // two concurrent fetches can race, and whichever resolves last overwrites
    // formData — silently discarding an edit made in the gap between them.
    let active = true;
    const load = async () => {
      const data = await getCorporateGovernance(selectedYear);
      if (active) setFormData(data);
    };
    load();
    return () => { active = false; };
  }, [selectedYear]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let val = type === 'number' ? parseFloat(value) || 0 : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleHtmlChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const result = await saveCorporateGovernance(formData, selectedYear);
    if (result.success) {
      alert('Corporate Governance data saved successfully.');
    } else {
      alert(`Failed to save Corporate Governance data: ${result.error || 'Unknown error.'}`);
    }
  };

  if (!formData) return <div>Loading...</div>;

  return (
    <div className="gov-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Corporate Governance</h2>
          <p className="text-secondary">IFRS S1 narrative disclosures — Governance, Strategy, Risk Management and Targets.</p>
        </div>
        <div className="header-actions">
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{`FYE ${y}`}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save Data
          </button>
        </div>
      </div>

      <div className="gov-grid">
        <div className="glass-card gov-section">
          <h3>B1 — Governance</h3>
          <div className="form-group">
            <label>Sustainability Committee Name</label>
            <input type="text" name="gov_committee_name" value={formData.gov_committee_name || ''} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Committee Meeting Frequency</label>
            <input type="text" name="gov_meeting_frequency" placeholder="e.g. Quarterly" value={formData.gov_meeting_frequency || ''} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Board Oversight Description</label>
            <textarea
              rows={4}
              className="input-field"
              value={formData.gov_board_oversight_text ? formData.gov_board_oversight_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('gov_board_oversight_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Executive Accountability</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.gov_executive_accountability_text ? formData.gov_executive_accountability_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('gov_executive_accountability_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Sustainability Strategy Integration</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.gov_strategy_integration_text ? formData.gov_strategy_integration_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('gov_strategy_integration_text', `<p>${e.target.value}</p>`)}
            />
          </div>
        </div>

        <div className="glass-card gov-section">
          <h3>B2 — Strategy</h3>
          <div className="form-group">
            <label>Short-Term Risks (0–1 year)</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.strategy_short_text ? formData.strategy_short_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('strategy_short_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Medium-Term Risks (1–5 years)</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.strategy_medium_text ? formData.strategy_medium_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('strategy_medium_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Long-Term Risks (5+ years)</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.strategy_long_text ? formData.strategy_long_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('strategy_long_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Climate Scenario Analysis</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.scenario_analysis_text ? formData.scenario_analysis_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('scenario_analysis_text', `<p>${e.target.value}</p>`)}
            />
          </div>
        </div>

        <div className="glass-card gov-section">
          <h3>B3 — Risk Management</h3>
          <div className="form-group">
            <label>Risk Identification Process</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.risk_identification_text ? formData.risk_identification_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('risk_identification_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>Risk Assessment Methodology</label>
            <textarea
              rows={3}
              className="input-field"
              value={formData.risk_assessment_text ? formData.risk_assessment_text.replace(/<[^>]*>?/gm, '') : ''}
              onChange={(e) => handleHtmlChange('risk_assessment_text', `<p>${e.target.value}</p>`)}
            />
          </div>
          <div className="form-group">
            <label>ERM Integration Status</label>
            <select name="risk_erm_integration_status" value={formData.risk_erm_integration_status || ''} onChange={handleInputChange} className="input-field">
              <option value="Fully Integrated">Fully Integrated</option>
              <option value="Partially Integrated">Partially Integrated</option>
              <option value="Not Yet Integrated">Not Yet Integrated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Climate Finance (IFRS S2) numeric metrics are edited from the
          Dashboard's "Climate Finance" tab, which covers the full field set —
          this page only owns the narrative/qualitative disclosures above. */}
    </div>
  );
};

export default Governance;
