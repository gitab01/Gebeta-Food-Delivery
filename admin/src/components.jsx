import React from 'react';
import { LABEL, ORDER_FLOW } from './api.js';

export const badgeClass = (status) => `badge ${String(status).toLowerCase()}`;

export function Badge({ status, label }) {
  return (
    <span className={badgeClass(status)}>
      <i />
      {label || LABEL[status] || status}
    </span>
  );
}

export function Kpi({ label, value, note }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}

export function Panel({ title, aside, children, scroll }) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          {aside}
        </div>
      </header>
      <div className={scroll ? 'body scroll' : 'body'} style={scroll ? { padding: 0 } : undefined}>
        {children}
      </div>
    </section>
  );
}

export function Notice({ kind = 'err', text }) {
  if (!text) return null;
  return <div className={`notice ${kind}`}>{text}</div>;
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

/** The state machine as it is defined on the server, drawn from the order's own history. */
export function Flow({ order }) {
  const seen = new Set((order.statusHistory || []).map((e) => e.status));
  const dead = ['REJECTED', 'CANCELLED'].includes(order.status);
  return (
    <div className="flow">
      {ORDER_FLOW.map((status, i) => {
        const done = seen.has(status) && status !== order.status;
        const now = status === order.status;
        return (
          <React.Fragment key={status}>
            {i > 0 ? <span className="sep">›</span> : null}
            <span className={`step ${done ? 'done' : now ? 'now' : ''}`}>
              <b />
              {LABEL[status]}
            </span>
          </React.Fragment>
        );
      })}
      {dead ? (
        <span className="step now" style={{ marginLeft: 8 }}>
          <b />
          {LABEL[order.status]}
        </span>
      ) : null}
    </div>
  );
}
