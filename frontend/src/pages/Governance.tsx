import { useState, useEffect } from 'react';
import { getGovernanceYears, getCorporateGovernance, saveCorporateGovernance } from '../utils/db';
import { Save } from 'lucide-react';
import { useReportingYear } from '../hooks/useReportingYear';
import './Governance.css';

const Governance = () => {
  const [formData, setFormData] = useState(null);
  const [governanceYears, setGovernanceYears] = useState<string[]>([]);
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(governanceYears);

  useEffect(() => {
    getGovernanceYears().then(setGovernanceYears);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await getCorporateGovernance(selectedYear);
      if (active) setFormData(data);
    };
    load();
    return () => { active = false; };
  }, [selectedYear]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val: any = type === 'number' ? (parseFloat(value) || 0) : type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleTextChange = (name: string, value: string) => {
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

  const tf = (name: string, rows = 3) => (
    <textarea
      rows={rows}
      className="input-field"
      name={name}
      value={formData[name] || ''}
      onChange={e => handleTextChange(name, e.target.value)}
    />
  );

  const inp = (name: string, placeholder = '') => (
    <input type="text" name={name} className="input-field"
      placeholder={placeholder}
      value={formData[name] || ''}
      onChange={handleInputChange} />
  );

  return (
    <div className="gov-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Corporate Governance</h2>
          <p className="text-secondary">IFRS S1 narrative disclosures — Governance, Strategy, Risk Management and Targets.</p>
        </div>
        <div className="header-actions">
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save Data
          </button>
        </div>
      </div>

      <div className="gov-grid">

        {/* ── B1 Governance ── */}
        <div className="glass-card gov-section">
          <h3>B1 — Governance</h3>

          <h4 className="gov-subsection">Oversight Mechanism</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Name of Board / Committee</label>
              {inp('gov_committee_name', 'e.g. Sustainability Committee')}
            </div>
            <div className="form-group">
              <label>Sustainability Oversight Frequency</label>
              {inp('gov_meeting_frequency', 'e.g. Quarterly')}
            </div>
          </div>
          <div className="form-group">
            <label>Description of Controls / Procedures</label>
            {tf('gov_board_oversight_text', 4)}
          </div>

          <h4 className="gov-subsection">Strategy Integration</h4>
          <div className="form-group">
            <label>How Risks Are Considered in Strategic Planning</label>
            {tf('gov_strategy_integration_text')}
          </div>
          <div className="form-group">
            <label>How Risks Affect Business Model / Value Chain</label>
            {tf('gov_business_model_impact_text')}
          </div>
          <div className="form-group">
            <label>Time Horizons Used (with year ranges for Short / Medium / Long)</label>
            {tf('gov_time_horizons_text', 2)}
          </div>

          <h4 className="gov-subsection">Executive Accountability</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Name &amp; Role of Accountable Executive</label>
              {inp('gov_exec_name_role', 'e.g. Chief Sustainability Officer — Jane Doe')}
            </div>
            <div className="form-group">
              <label>Board Reporting Document URL</label>
              {inp('gov_board_report_url', 'https://...')}
            </div>
          </div>
          <div className="form-group">
            <label>General Executive Accountability Description</label>
            {tf('gov_executive_accountability_text')}
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="gov_exec_kpi_pay_linked"
                checked={!!formData.gov_exec_kpi_pay_linked}
                onChange={handleInputChange}
              />
              &nbsp;Sustainability KPIs Linked to Executive Pay
            </label>
          </div>
          {formData.gov_exec_kpi_pay_linked && (
            <div className="form-group">
              <label>Description of KPIs in Executive Pay</label>
              {tf('gov_exec_kpi_pay_desc')}
            </div>
          )}
        </div>

        {/* ── B2 Strategy ── */}
        <div className="glass-card gov-section">
          <h3>B2 — Strategy</h3>

          <h4 className="gov-subsection">Time Horizon Risk Planning</h4>
          <div className="form-group">
            <label>Short-Term Risks (0–1 year)</label>
            {tf('strategy_short_text')}
          </div>
          <div className="form-group">
            <label>Medium-Term Risks (1–5 years)</label>
            {tf('strategy_medium_text')}
          </div>
          <div className="form-group">
            <label>Long-Term Risks (5+ years)</label>
            {tf('strategy_long_text')}
          </div>

          <h4 className="gov-subsection">Climate Scenario Resilience Summary</h4>
          <div className="form-group">
            <label>Scenario(s) Used and Source</label>
            {tf('scenario_scenarios_used_text', 2)}
          </div>
          <div className="form-group">
            <label>Key Assumptions Applied</label>
            {tf('scenario_key_assumptions_text')}
          </div>
          <div className="form-group">
            <label>Qualitative Resilience Summary</label>
            {tf('scenario_resilience_summary_text')}
          </div>
          <div className="form-group">
            <label>Identified Gaps / Vulnerabilities</label>
            {tf('scenario_gaps_text')}
          </div>
          <div className="form-group">
            <label>General Climate Scenario Notes (legacy)</label>
            {tf('scenario_analysis_text')}
          </div>
        </div>

        {/* ── B3 Risk Management ── */}
        <div className="glass-card gov-section">
          <h3>B3 — Risk Management</h3>

          <h4 className="gov-subsection">Risk Identification</h4>
          <div className="form-group">
            <label>List of Material Risk Topics (Risk Identification Process)</label>
            {tf('risk_identification_text')}
          </div>
          <div className="form-group">
            <label>Methodology / Framework Used (TCFD, GRI, Double Materiality)</label>
            {tf('risk_assessment_text')}
          </div>
          <div className="form-group">
            <label>Risk Prioritisation Criteria</label>
            {tf('risk_prioritisation_text')}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Frequency of Risk Review Cycle</label>
              {inp('risk_review_frequency', 'e.g. Annual, Semi-annual')}
            </div>
          </div>

          <h4 className="gov-subsection">ERM Matrix Integration</h4>
          <div className="form-row">
            <div className="form-group">
              <label>ERM Integration Status</label>
              <select name="risk_erm_integration_status" value={formData.risk_erm_integration_status || ''} onChange={handleInputChange} className="input-field">
                <option value="Fully Integrated">Fully Integrated</option>
                <option value="Partially Integrated">Partially Integrated</option>
                <option value="Not Yet Integrated">Not Yet Integrated</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>How Sustainability Risks Map onto the Risk Register</label>
            {tf('risk_register_mapping_text')}
          </div>
          <div className="form-group">
            <label>Risk Owner Assignment (e.g. CFO, COO, Function Leads)</label>
            {tf('risk_owner_assignment_text', 2)}
          </div>
          <div className="form-group">
            <label>Mitigation Actions Recorded Against Each Risk</label>
            {tf('risk_mitigation_actions_text')}
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
