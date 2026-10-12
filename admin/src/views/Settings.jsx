import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { mapsConfigured } from '../citymap.jsx';
import { Field, Notice, Panel } from '../components.jsx';

const SWITCHES = [
  { key: 'mapsEnabled', label: 'City map', hint: 'Plot kitchens and couriers on the live ops board.' },
  { key: 'notifyNewOrder', label: 'New order alerts', hint: 'Ping operations when an order lands.' },
  { key: 'notifyCourierOffline', label: 'Courier offline alerts', hint: 'Ping when a carrying courier stops reporting.' },
  { key: 'maintenanceMode', label: 'Maintenance mode', hint: 'Stops new orders at the API, exactly as the mobile apps see it.' }
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={Boolean(checked)}
    >
      <i />
    </button>
  );
}

export default function SettingsView() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.settings();
      setMeta({ version: data.version, gateway: data.gateway });
      setForm(data.settings);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!form) {
    return (
      <>
        <Notice text={error} />
        <p className="sub">Loading configuration…</p>
      </>
    );
  }

  const set = (key) => (value) => setForm({ ...form, [key]: value });

  const save = async () => {
    setBusy(true);
    setSaved('');
    try {
      const { settings } = await api.saveSettings(form);
      setForm(settings);
      setSaved('Saved. The mobile apps pick these up on their next request.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Notice text={error} />
      <Notice kind="ok" text={saved} />

      <div className="split">
        <Panel title="Marketplace">
          <div className="switches">
            {SWITCHES.map((s) => (
              <div className="switchrow" key={s.key}>
                <div className="grow">
                  <div className="strong">{s.label}</div>
                  <div className="tiny dim">{s.hint}</div>
                </div>
                <Toggle checked={Boolean(form[s.key])} onChange={set(s.key)} />
              </div>
            ))}
          </div>

          {!mapsConfigured() && form.mapsEnabled ? (
            <Notice text="No map key is compiled into this console, so the live board draws a schematic from the same positions." />
          ) : null}

          <Field label="Support contact">
            <input value={form.supportContact || ''} onChange={(e) => set('supportContact')(e.target.value)} placeholder="+251 …" />
          </Field>
        </Panel>

        <Panel title="Region">
          <Field label="Currency">
            <input value={form.currency || ''} onChange={(e) => set('currency')(e.target.value)} />
          </Field>
          <Field label="Default language">
            <select value={form.language || 'en'} onChange={(e) => set('language')(e.target.value)}>
              <option value="en">English</option>
              <option value="am">አማርኛ (Amharic)</option>
              <option value="ti">ትግርኛ (Tigrinya)</option>
              <option value="om">Afaan Oromoo</option>
            </select>
          </Field>
          <Field label="Timezone">
            <input value={form.timezone || ''} onChange={(e) => set('timezone')(e.target.value)} />
          </Field>
          <Field label="Date format">
            <input value={form.dateFormat || ''} onChange={(e) => set('dateFormat')(e.target.value)} />
          </Field>

          <dl className="tiny">
            <dt>Gateway</dt>
            <dd>{meta?.gateway || '—'}</dd>
            <dt>Console</dt>
            <dd className="num">v{meta?.version || '—'}</dd>
          </dl>

          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn dark" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn" onClick={load} disabled={busy}>
              Reload
            </button>
          </div>

          <p className="sub" style={{ marginTop: 14 }}>
            A Google Maps key is a client value, not a record: it belongs in this console's build environment, never in a document an operator can read back.
          </p>
        </Panel>
      </div>
    </>
  );
}
