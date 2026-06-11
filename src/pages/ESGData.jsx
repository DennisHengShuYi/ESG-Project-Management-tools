import { useState, useEffect } from 'react';
import { getEventsFull, saveGreenOps, saveHealthSafety, saveProcurement } from '../utils/db';
import { Save, AlertCircle } from 'lucide-react';
import './ESGData.css';

const ESGData = ({ eventId }) => {
  const [events, setEvents]             = useState([]);
  const [selectedEventId, setSelectedId] = useState('');
  const [formData, setFormData]         = useState(null);

  useEffect(() => {
    const load = async () => {
      const loaded = await getEventsFull();
      setEvents(loaded);
      const initId = eventId || loaded[0]?.id;
      if (initId) {
        setSelectedId(initId);
        setFormData(loaded.find(e => e.id === initId) || null);
      }
    };
    load();
  }, [eventId]);

  const handleEventChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    setFormData(events.find(ev => ev.id === id) || null);
  };

  const set = (name, value) => {
    setFormData(prev => {
      const u = { ...prev, [name]: value };
      // Auto-derive waste_diverted_pct locally for display
      if (['waste_hazardous_kg','waste_nonhazardous_kg','waste_recycled_kg'].includes(name)) {
        const total   = (u.waste_hazardous_kg || 0) + (u.waste_nonhazardous_kg || 0);
        const diverted = u.waste_recycled_kg || 0;
        u.waste_diverted_pct = total > 0 ? (diverted / total) * 100 : 0;
      }
      // Auto-derive LTIR locally for display
      if (['lti_count','man_hours_actual'].includes(name)) {
        u.ltir = u.man_hours_actual > 0 ? ((u.lti_count || 0) * 200000) / u.man_hours_actual : 0;
      }
      return u;
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    set(name, type === 'number' ? parseFloat(value) || 0 : value);
  };

  const handleSave = async () => {
    if (!formData) return;
    await Promise.all([
      saveGreenOps(formData.id, formData),
      saveHealthSafety(formData.id, formData),
      saveProcurement(formData.id, formData),
    ]);
    // Refresh flat data
    const updated = await getEventsFull();
    setEvents(updated);
    const refreshed = updated.find(e => e.id === formData.id);
    if (refreshed) setFormData(refreshed);
    alert('ESG Data saved successfully.');
  };

  if (!formData) return <div>Loading…</div>;

  return (
    <div className={`esg-container ${!eventId ? 'animate-fade-in' : ''}`}>
      {!eventId && (
        <div className="page-header">
          <div>
            <h2>ESG Data Entry</h2>
            <p className="text-secondary">Input environmental, social, and governance metrics per event.</p>
          </div>
          <div className="header-actions">
            <select className="input-field" value={selectedEventId} onChange={handleEventChange}>
              {events.map(e => <option key={e.id} value={e.id}>{e.event_name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={18} /> Save Data
            </button>
          </div>
        </div>
      )}

      {eventId && (
        <div className="flex justify-end mb-4">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save ESG Data
          </button>
        </div>
      )}

      <div className="esg-grid">
        {/* Module A — Green Ops */}
        <div className="glass-card esg-section">
          <h3>Module A — Green Operations</h3>
          <div className="form-group">
            <label>Total Energy Consumption (MWh)</label>
            <input type="number" name="total_energy_mwh" value={formData.total_energy_mwh || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Renewable Energy (MWh)</label>
            <input type="number" name="renewable_energy_mwh" value={formData.renewable_energy_mwh || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group readonly">
            <label>Renewable Energy Share (%)</label>
            <input type="number" value={(formData.renewable_energy_pct || 0).toFixed(1)} readOnly className="input-field" />
          </div>
          <div className="form-group">
            <label>Water Consumption (m³)</label>
            <input type="number" name="total_water_m3" value={formData.total_water_m3 || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Hazardous Waste (kg)</label>
            <input type="number" name="waste_hazardous_kg" value={formData.waste_hazardous_kg || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Non-Hazardous Waste (kg)</label>
            <input type="number" name="waste_nonhazardous_kg" value={formData.waste_nonhazardous_kg || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Waste Diverted (recycled/composted) (kg)</label>
            <input type="number" name="waste_recycled_kg" value={formData.waste_recycled_kg || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group readonly">
            <label>Waste Diversion Rate (%)</label>
            <input type="number" value={(formData.waste_diverted_pct || 0).toFixed(1)} readOnly className="input-field" />
          </div>
          <div className="form-group">
            <label>Scope 1 Emissions (tCO₂e)</label>
            <input type="number" name="scope1_tco2e" value={formData.scope1_tco2e || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Scope 2 Emissions (tCO₂e)</label>
            <input type="number" name="scope2_lb_tco2e" value={formData.scope2_lb_tco2e || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Scope 3 Emissions (tCO₂e)</label>
            <input type="number" name="scope3_tco2e" value={formData.scope3_tco2e || 0} onChange={handleInputChange} className="input-field" />
          </div>
        </div>

        {/* Module B — Health & Safety */}
        <div className="glass-card esg-section">
          <h3>Module B — Health, Safety &amp; Labour</h3>
          <div className="form-group">
            <label>Total Hours Worked</label>
            <input type="number" name="man_hours_actual" value={formData.man_hours_actual || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Lost Time Injuries (LTI count)</label>
            <input type="number" name="lti_count" value={formData.lti_count || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group readonly">
            <label>LTIR (per 200,000 hrs)</label>
            <input type="number" value={(formData.ltir || 0).toFixed(4)} readOnly className="input-field" />
          </div>
          <div className="form-group">
            <label>Work-Related Fatalities</label>
            <input type="number" name="fatalities_count" value={formData.fatalities_count || 0} onChange={handleInputChange} className="input-field" />
            {formData.fatalities_count > 0 && (
              <span className="alert-text text-danger"><AlertCircle size={14} /> Mandatory Alert Triggered</span>
            )}
          </div>
          <div className="form-group">
            <label>Safety Training Headcount</label>
            <input type="number" name="safety_trained_count" value={formData.safety_trained_count || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Total Headcount</label>
            <input type="number" name="total_headcount" value={formData.total_headcount || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Contract &amp; Temp Staff Count</label>
            <input type="number" name="staff_contractor_count" value={formData.staff_contractor_count || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Employee Training Hours (total)</label>
            <input type="number" name="training_hours_total" value={formData.training_hours_total || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Human Rights Complaints</label>
            <input type="number" name="hr_complaints_count" value={formData.hr_complaints_count || 0} onChange={handleInputChange} className="input-field" />
          </div>
        </div>

        {/* Module C — Procurement */}
        <div className="glass-card esg-section">
          <h3>Module C — Procurement &amp; Community</h3>
          <div className="form-group">
            <label>Total Procurement Spend (RM)</label>
            <input type="number" name="procurement_total_rm" value={formData.procurement_total_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Local Supplier Spend (RM)</label>
            <input type="number" name="local_supplier_spend_rm" value={formData.local_supplier_spend_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group readonly">
            <label>Local Supplier Spend (%)</label>
            <input type="number"
              value={formData.procurement_total_rm
                ? ((formData.local_supplier_spend_rm || 0) / formData.procurement_total_rm * 100).toFixed(1)
                : 0}
              readOnly className="input-field" />
          </div>
          <div className="form-group">
            <label>Community Investment (RM)</label>
            <input type="number" name="community_invest_rm" value={formData.community_invest_rm || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Community Beneficiaries (count)</label>
            <input type="number" name="community_beneficiaries" value={formData.community_beneficiaries || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Privacy Breaches (count)</label>
            <input type="number" name="data_breach_complaints" value={formData.data_breach_complaints || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Sustainable Catering Rate (%)</label>
            <input type="number" name="sustainable_catering_pct" value={formData.sustainable_catering_pct || 0} onChange={handleInputChange} className="input-field" />
          </div>
          <div className="form-group">
            <label>Surplus Food Recovered (kg)</label>
            <input type="number" name="food_recovery_kg" value={formData.food_recovery_kg || 0} onChange={handleInputChange} className="input-field" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESGData;
