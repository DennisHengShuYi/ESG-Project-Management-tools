import { useState, useEffect } from 'react';
import { getCorporateGovernance, saveCorporateGovernance } from '../utils/db';
import { Save } from 'lucide-react';
import './Governance.css';

const Governance = () => {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setFormData(await getCorporateGovernance());
    };
    load();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let val = type === 'number' ? parseFloat(value) || 0 : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleHtmlChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    await saveCorporateGovernance(formData);
    alert('Corporate Governance data saved successfully.');
  };

  if (!formData) return <div>Loading...</div>;

  return (
    <div className="gov-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Corporate Governance</h2>
          <p className="text-secondary">IFRS S1 narrative disclosures — Governance, Strategy, Risk Management and Targets.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> Save Data
        </button>
      </div>

      <div className="gov-grid">
        <div className="glass-card gov-section">
          <h3>B1 — Governance</h3>
          <div className="form-group">
            <label>Sustainability Committee Name</label>
            <input type="text" name="gov_committee_name" value={formData.gov_committee_name || ''} onChange={handleInputChange} className="input-field" />
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
        </div>

        <div className="glass-card gov-section">
          <h3>B2 — Strategy</h3>
          <div className="form-group">
            <label>Short-Term Risks (0–1 year)</label>
            <textarea 
              rows={3} 
              className="input-field" 
              value={formData.strategy_short_term_text ? formData.strategy_short_term_text.replace(/<[^>]*>?/gm, '') : ''} 
              onChange={(e) => handleHtmlChange('strategy_short_term_text', `<p>${e.target.value}</p>`)} 
            />
          </div>
          <div className="form-group">
            <label>Medium-Term Risks (1–5 years)</label>
            <textarea 
              rows={3} 
              className="input-field" 
              value={formData.strategy_medium_term_text ? formData.strategy_medium_term_text.replace(/<[^>]*>?/gm, '') : ''} 
              onChange={(e) => handleHtmlChange('strategy_medium_term_text', `<p>${e.target.value}</p>`)} 
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
            <label>ERM Integration Status</label>
            <select name="risk_erm_integration_status" value={formData.risk_erm_integration_status || ''} onChange={handleInputChange} className="input-field">
              <option value="Fully Integrated">Fully Integrated</option>
              <option value="Partially Integrated">Partially Integrated</option>
              <option value="Not Yet Integrated">Not Yet Integrated</option>
            </select>
          </div>
        </div>

        <div className="glass-card gov-section">
          <h3>IFRS S2 — Climate Finance</h3>
          <div className="form-group">
            <label>Transition Risk Exposure (RM)</label>
            <input type="number" name="climate_transition_risk_rm" value={formData.climate_transition_risk_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Physical Risk Exposure (RM)</label>
            <input type="number" name="climate_physical_risk_rm" value={formData.climate_physical_risk_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Capital Deployed for Climate (RM)</label>
            <input type="number" name="climate_capex_rm" value={formData.climate_capex_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Governance;
