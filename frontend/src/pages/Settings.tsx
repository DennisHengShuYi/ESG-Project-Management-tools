import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/db';
import { Settings as SettingsIcon, Save, Users, Bell, Database } from 'lucide-react';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // See Governance.tsx for why this guard matters: without it,
    // React.StrictMode's dev-mode double-invoke can let a stale fetch
    // silently overwrite an edit made in the gap between the two calls.
    let active = true;
    const load = async () => {
      const data = await getSettings();
      if (active) setSettings(data);
    };
    load();
    return () => { active = false; };
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('framework_')) {
      const fw = name.replace('framework_', '');
      setSettings(prev => ({
        ...prev,
        frameworks: { ...prev.frameworks, [fw]: checked }
      }));
      return;
    }

    let val = type === 'number' ? parseFloat(value) || 0 : value;
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async () => {
    await saveSettings(settings);
    alert('Settings saved successfully.');
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <div className="settings-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Settings & Admin</h2>
          <p className="text-secondary">System configuration, carbon pricing, framework toggles and audit log.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> Save Settings
        </button>
      </div>

      <div className="settings-grid">
        <div className="glass-card settings-section">
          <div className="section-header">
            <SettingsIcon size={20} className="text-primary" />
            <h3>System Configuration</h3>
          </div>
          
          <div className="form-group">
            <label>Internal Carbon Price (RM/tCO2e)</label>
            <input type="number" name="internal_carbon_price" value={settings.internal_carbon_price || 0} onChange={handleInputChange} className="input-field" />
            <span className="help-text">Used to calculate shadow carbon costs.</span>
          </div>
          
          <div className="form-group">
            <label>Grid Emission Factor (kgCO2e/kWh)</label>
            <input type="number" name="grid_emission_factor" step="0.001" value={settings.grid_emission_factor || 0} onChange={handleInputChange} className="input-field" />
            <span className="help-text">Peninsular Malaysia (TNB) default is 0.694.</span>
          </div>
          
          <div className="form-group">
            <label>Reporting Financial Year End</label>
            <input type="text" name="reporting_fye" value={settings.reporting_fye || ''} onChange={handleInputChange} className="input-field" />
          </div>
        </div>

        <div className="glass-card settings-section">
          <div className="section-header">
            <Bell size={20} className="text-warning" />
            <h3>Alert Thresholds</h3>
          </div>
          
          <div className="form-group">
            <label>LTIR Threshold</label>
            <input type="number" name="ltir_threshold" step="0.1" value={settings.ltir_threshold || 0} onChange={handleInputChange} className="input-field" />
            <span className="help-text">Trigger dashboard alert if exceeded.</span>
          </div>
          
          <div className="form-group">
            <label>High Risk Score Threshold</label>
            <input type="number" name="high_risk_threshold" value={settings.high_risk_threshold || 0} onChange={handleInputChange} className="input-field" />
            <span className="help-text">Risks scoring above this (Likelihood x Impact) are flagged.</span>
          </div>
        </div>

        <div className="glass-card settings-section">
          <div className="section-header">
            <Database size={20} className="text-info" />
            <h3>Framework Toggles</h3>
          </div>
          
          <div className="toggle-list">
            <div className="toggle-item">
              <div>
                <span className="font-medium block">Bursa Malaysia PN9-A</span>
                <span className="text-sm text-secondary">Mandatory for all Malaysian PLCs</span>
              </div>
              <input type="checkbox" checked={true} disabled className="toggle-switch" />
            </div>
            
            <div className="toggle-item">
              <div>
                <span className="font-medium block">IFRS S1 General Requirements</span>
              </div>
              <input type="checkbox" name="framework_ifrs1" checked={settings.frameworks?.ifrs1} onChange={handleInputChange} className="toggle-switch" />
            </div>
            
            <div className="toggle-item">
              <div>
                <span className="font-medium block">IFRS S2 Climate Disclosures</span>
              </div>
              <input type="checkbox" name="framework_ifrs2" checked={settings.frameworks?.ifrs2} onChange={handleInputChange} className="toggle-switch" />
            </div>
            
            <div className="toggle-item">
              <div>
                <span className="font-medium block">GRI Standards Mapping</span>
              </div>
              <input type="checkbox" name="framework_gri" checked={settings.frameworks?.gri} onChange={handleInputChange} className="toggle-switch" />
            </div>
            
            <div className="toggle-item">
              <div>
                <span className="font-medium block">UN SDG Alignment</span>
              </div>
              <input type="checkbox" name="framework_sdg" checked={settings.frameworks?.sdg} onChange={handleInputChange} className="toggle-switch" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
