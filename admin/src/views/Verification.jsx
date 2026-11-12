import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clock, documentPhoto } from '../api.js';
import { Badge, Empty, Field, Kpi, Notice, Panel } from '../components.jsx';

const FILTERS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'Every file' }
];

const DOC = {
  national_id: 'National ID',
  passport: 'Passport',
  driving_licence: 'Driving licence'
};

const TONE = { pending: 'READY', approved: 'COMPLETED', rejected: 'REJECTED' };

/** How long a file has been sitting, in the unit an operator actually acts on. */
function waited(iso) {
  if (!iso) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} days`;
}

const size = (bytes) => (bytes ? `${Math.round(bytes / 1024)} KB` : '—');

/**
 * One side of a courier's identity document. The bytes come through the API with the operator's
 * header, so they arrive as an object URL and are revoked as soon as this file is put down.
 */
function Photo({ userId, side, open, onToggle }) {
  const [state, setState] = useState({ url: '', error: '', loading: Boolean(userId) });

  useEffect(() => {
    if (!userId) return undefined;
    let url = '';
    let settled = false;
    const controller = new AbortController();
    setState({ url: '', error: '', loading: true });
    documentPhoto(userId, side, controller.signal)
      .then((created) => {
        if (settled) {
          URL.revokeObjectURL(created);
          return;
        }
        url = created;
        setState({ url, error: '', loading: false });
      })
      .catch((err) => {
        if (settled || err.name === 'AbortError') return;
        setState({ url: '', error: err.message, loading: false });
      });
    return () => {
      settled = true;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [userId, side]);

  return (
    <div className="doc">
      <b>
        {side === 'front' ? 'Front' : 'Back'}
        <span className="tiny dim">{state.url ? ' — tap to enlarge' : ''}</span>
      </b>
      {state.loading ? <div className="frame">Reading photo…</div> : null}
      {state.error ? <div className="frame error">{state.error}</div> : null}
      {state.url && !state.loading ? (
        <img src={state.url} alt={`Document ${side}`} className={open ? 'open' : ''} onClick={onToggle} />
      ) : null}
    </div>
  );
}

export default function Verification({ tick }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState('');
  const [zoom, setZoom] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.courierQueue('all');
      setRows(data.couriers);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  // The selection has to survive a refresh: the queue is rebuilt from the server's rows.
  useEffect(() => {
    if (!picked) return;
    if (!rows.some((r) => r.userId === picked.userId)) setPicked(null);
  }, [rows, picked]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.verification.status === filter)),
    [rows, filter]
  );

  const selected = useMemo(() => rows.find((r) => r.userId === picked?.userId) || null, [rows, picked]);

  const counts = useMemo(() => {
    const by = (status) => rows.filter((r) => r.verification.status === status);
    const waiting = by('pending');
    const oldest = waiting.length ? waiting.reduce((a, b) => (a.submittedAt < b.submittedAt ? a : b)) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      pending: waiting.length,
      approved: by('approved').length,
      rejected: by('rejected').length,
      today: by('approved').filter((r) => new Date(r.verification.reviewedAt) >= today).length,
      oldest: oldest ? `${oldest.name} · ${waited(oldest.verification.submittedAt)}` : 'nobody waiting'
    };
  }, [rows]);

  const decide = async (decision) => {
    if (!selected) return;
    setSaved('');
    setError('');
    try {
      const { courier } = await api.reviewCourier(selected.userId, { decision, note });
      setNote('');
      setZoom('');
      setSaved(
        `${courier.name} is ${courier.verification.status}. They have been told on their own app.`
      );
      await load();
      if (decision === 'approve' && courier.verification.status === 'approved') setFilter('pending');
    } catch (err) {
      setError(err.message);
    }
  };

  const incomplete = selected && !(selected.verification.hasFront && selected.verification.hasBack);

  return (
    <>
      <div className="kpis">
        <Kpi label="Waiting" value={counts.pending} note='need a decision' />
        <Kpi label="Longest wait" value={waited(rows.find((r) => r.verification.status === 'pending')?.verification.submittedAt || null)} note={counts.oldest} />
        <Kpi label="Approved today" value={counts.today} note='since midnight' />
        <Kpi label="Cleared" value={counts.approved} note='may work and take jobs' />
        <Kpi label="Rejected" value={counts.rejected} note='told why, can re-file' />
      </div>

      <Notice text={error} />
      <Notice kind="ok" text={saved} />

      <div className="split">
        <Panel
          title="Verification queue"
          scroll
          aside={
            <div className="seg" role="group" aria-label="Which files to show">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          {!visible.length ? (
            <Empty text={filter === 'pending' ? 'Nobody is waiting — every courier file has been reviewed.' : 'No file in this state.'} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Courier</th>
                  <th>Document</th>
                  <th>Submitted</th>
                  <th>Papers</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.userId}
                    className={selected?.userId === row.userId ? 'sel' : ''}
                    onClick={() => {
                      setPicked(row);
                      setNote('');
                      setZoom('');
                    }}
                  >
                    <td>
                      <div>{row.name}</div>
                      <div className="tiny dim num">{row.phone}</div>
                    </td>
                    <td className="tiny">{DOC[row.verification.documentType] || '—'}</td>
                    <td className="tiny dim">{waited(row.verification.submittedAt)}</td>
                    <td className="tiny">
                      {row.verification.hasFront && row.verification.hasBack
                        ? size(row.verification.photoBytes)
                        : row.verification.status === 'pending'
                          ? 'incomplete'
                          : '—'}
                    </td>
                    <td>
                      <Badge status={TONE[row.verification.status]} label={row.verification.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: 'grid', gap: 20 }}>
          <Panel title={selected ? `Review — ${selected.name}` : 'Review'}>
            {!selected ? (
              <Empty text="Pick a courier on the left to read both sides of their document before deciding." />
            ) : (
              <>
                <div className="docs">
                  <Photo userId={selected.userId} side="front" open={zoom === 'front'} onToggle={() => setZoom(zoom === 'front' ? '' : 'front')} />
                  <Photo userId={selected.userId} side="back" open={zoom === 'back'} onToggle={() => setZoom(zoom === 'back' ? '' : 'back')} />
                </div>

                {incomplete ? (
                  <Notice text="This file is missing one side. Ask for both before deciding — a single photo proves nothing." />
                ) : null}

                <dl>
                  <dt>Account</dt>
                  <dd className="num tiny">{selected.phone}</dd>
                  <dt>Vehicle</dt>
                  <dd>{selected.vehicle}</dd>
                  <dt>Document</dt>
                  <dd>{DOC[selected.verification.documentType] || 'none on file'}</dd>
                  <dt>Submitted</dt>
                  <dd className="tiny">
                    {clock(selected.verification.submittedAt)} · {waited(selected.verification.submittedAt)} ago
                  </dd>
                  <dt>State</dt>
                  <dd>
                    <Badge status={TONE[selected.verification.status]} label={selected.verification.status} />
                  </dd>
                  {selected.verification.reviewedAt ? (
                    <>
                      <dt>Reviewed</dt>
                      <dd className="tiny">{clock(selected.verification.reviewedAt)}</dd>
                    </>
                  ) : null}
                  {selected.verification.reviewNote ? (
                    <>
                      <dt>Last note</dt>
                      <dd className="tiny">{selected.verification.reviewNote}</dd>
                    </>
                  ) : null}
                </dl>

                <Field label="Note to the courier">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={selected.verification.status === 'pending' ? 'Why the photos were accepted, or what to re-shoot' : 'Reason for the change'}
                  />
                </Field>

                <div className="actions">
                  <button className="btn dark" onClick={() => decide('approve')}>
                    {selected.verification.status === 'approved' ? 'Keep approved' : 'Approve'}
                  </button>
                  <button className="btn danger" onClick={() => decide('reject')}>
                    {selected.verification.status === 'approved' ? 'Revoke' : 'Reject'}
                  </button>
                </div>
              </>
            )}
          </Panel>

          <Panel title="What approval opens">
            <p className="tiny dim">
              Approval is the only thing that puts a courier in front of an order. The dispatch search asks MongoDB for
              couriers whose file reads <span className="num">approved</span>, so a revoked courier stops receiving offers
              on the next search rather than on the next restart.
            </p>
            <p className="tiny dim" style={{ marginTop: 10 }}>
              An applicant who is rejected sees the note in their own app and can re-file both photos; the re-filing
              returns them to this queue with the clock reset.
            </p>
            <p className="tiny dim" style={{ marginTop: 10 }}>
              Photos are fetched one side at a time, on demand, and never leave this browser tab: the list above carries
              byte counts only, and every response is marked private and no-store.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
