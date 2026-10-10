import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ageMinutes, api, clock, LABEL } from '../api.js';
import { Badge, Empty, Kpi, Notice, Panel } from '../components.jsx';

const VEHICLE_GLYPH = { motorbike: 'M', bicycle: 'B', car: 'C', walk: 'W' };

/**
 * `locationUpdatedAt` is the only honest signal of whether a courier's app is
 * still reporting, so the pool is judged on ping age rather than the online flag.
 */
function pingState(courier) {
  const age = ageMinutes(courier.locationUpdatedAt);
  if (age == null) return { label: 'never reported', tone: 'cancelled' };
  if (age <= 2) return { label: `${age}m ago`, tone: 'completed' };
  if (age <= 10) return { label: `${age}m ago`, tone: 'ready' };
  return { label: `${age}m ago`, tone: 'cancelled' };
}

export default function Couriers({ tick }) {
  const [couriers, setCouriers] = useState([]);
  const [jobs, setJobs] = useState({});
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.couriers();
      setCouriers(data.couriers);
      setJobs(data.liveJobs || {});
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const picked = useMemo(() => couriers.find((c) => c.id === openId) || null, [couriers, openId]);
  const online = couriers.filter((c) => c.isOnline);
  const carrying = couriers.filter((c) => c.activeOrders > 0);
  const rated = couriers.filter((c) => c.ratingCount > 0);
  const average = rated.length ? rated.reduce((s, c) => s + c.ratingStars, 0) / rated.length : null;
  const stale = online.filter((c) => ageMinutes(c.locationUpdatedAt) > 10).length;

  return (
    <>
      <div className="kpis">
        <Kpi label="Online" value={`${online.length}/${couriers.length}`} note='open in the app' />
        <Kpi label="Carrying" value={carrying.length} note='at least one live job' />
        <Kpi label="Idle online" value={Math.max(0, online.length - carrying.length)} note='ready for an offer' />
        <Kpi label="Avg rating" value={average ? average.toFixed(2) : '—'} note={`${rated.length} rated couriers`} />
        <Kpi label="Silent >10 min" value={stale} note='online but not pinging' />
      </div>

      <Notice text={error} />

      <div className="split">
        <Panel title="Courier pool" scroll>
          {!couriers.length ? (
            <Empty text="No couriers have registered yet." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Courier</th>
                  <th>Presence</th>
                  <th>Jobs</th>
                  <th>Delivered</th>
                  <th>Rating</th>
                  <th>Last ping</th>
                </tr>
              </thead>
              <tbody>
                {couriers.map((c) => {
                  const ping = pingState(c);
                  return (
                    <tr key={c.id} className={openId === c.id ? 'sel' : ''} onClick={() => setOpenId(c.id)}>
                      <td>
                        <div className="row">
                          <span className="badge neutral" title={c.vehicle}>
                            <i />
                            {VEHICLE_GLYPH[c.vehicle] || '?'}
                          </span>
                          <span>
                            <div>{c.name}</div>
                            <div className="tiny dim">{c.vehicle}</div>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge status={c.isOnline ? 'COMPLETED' : 'CANCELLED'} label={c.isOnline ? 'Online' : 'Offline'} />
                      </td>
                      <td className="num">
                        {c.activeOrders || 0}
                        {jobs[c.id] ? <div className="tiny dim">{LABEL[jobs[c.id]]}</div> : null}
                      </td>
                      <td className="num">{c.completedDeliveries}</td>
                      <td className="num">{c.ratingCount ? `${c.ratingStars.toFixed(1)} · ${c.ratingCount}` : '—'}</td>
                      <td>
                        <span className={`badge ${ping.tone}`}>
                          <i />
                          {ping.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: 'grid', gap: 20 }}>
          <Panel title={picked ? picked.name : 'Courier'}>
            {!picked ? (
              <Empty text="Select a courier to see what the last assignment window knows about them." />
            ) : (
              <dl>
                <dt>Account</dt>
                <dd className="num tiny">{picked.userId}</dd>
                <dt>Vehicle</dt>
                <dd>{picked.vehicle}</dd>
                <dt>Reported position</dt>
                <dd className="num tiny">
                  {picked.lat != null ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : 'never reported'}
                </dd>
                <dt>Last update</dt>
                <dd className="tiny">{clock(picked.locationUpdatedAt)}</dd>
                <dt>Live job</dt>
                <dd>{jobs[picked.id] ? LABEL[jobs[picked.id]] : 'none'}</dd>
                <dt>Lifetime</dt>
                <dd className="num">{picked.completedDeliveries} delivered</dd>
              </dl>
            )}
            <p className="tiny dim" style={{ marginTop: 14 }}>
              Positions arrive over the socket from the courier app and are throttled server-side; the pool above
              refreshes on the same events, so a courier who closes the app stops moving here within one ping interval.
            </p>
          </Panel>

          <Panel title="Dispatch pressure">
            <dl>
              <dt>In the pool</dt>
              <dd className="num">{online.length} available now</dd>
              <dt>Load</dt>
              <dd className="num">
                {carrying.reduce((s, c) => s + c.activeOrders, 0)} jobs across {carrying.length} couriers
              </dd>
              <dt>Earnings view</dt>
              <dd className="tiny">
                Couriers see their own fees in the delivery app; operations reads totals from the order ledger.
              </dd>
            </dl>
            <div className="bar" style={{ marginTop: 14 }}>
              <i style={{ width: `${couriers.length ? Math.round((online.length / couriers.length) * 100) : 0}%` }} />
            </div>
            <p className="tiny dim" style={{ marginTop: 8 }}>
              {couriers.length ? `${Math.round((online.length / couriers.length) * 100)}% of registered couriers are online` : 'No couriers registered'}
            </p>
            <p className="tiny dim">
              When an order reaches the kitchen's ready state, the radius search starts at the nearest online courier
              and widens, so a thin pool shows up as orders parked in Ready with an offer count climbing.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
