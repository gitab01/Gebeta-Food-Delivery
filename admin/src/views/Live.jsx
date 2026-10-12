import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ageMinutes, api, clock, distance, LABEL, money, TERMINAL } from '../api.js';
import { Badge, Empty, Field, Flow, Kpi, Notice, Panel } from '../components.jsx';
import { CityMap } from '../citymap.jsx';

/** UI mirror of the server's state machine. The server still refuses anything illegal. */
const NEXT = {
  PLACED: ['CANCELLED'],
  PAID: ['PREPARING', 'REJECTED', 'CANCELLED'],
  PREPARING: ['READY', 'ASSIGNED', 'CANCELLED'],
  READY: ['ASSIGNED', 'PICKED_UP', 'CANCELLED'],
  ASSIGNED: ['READY', 'PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: ['COMPLETED']
};

function Ticker({ events }) {
  if (!events.length) return <Empty text="Waiting for the first realtime event." />;
  return (
    <ul className="timeline">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <time>{clock(e.at.toISOString())}</time>
          <span>
            <span className="who">{e.name}</span>
            <div className="tiny">
              {e.payload?.status ? <Badge status={e.payload.status} /> : null}{' '}
              {e.payload?.name || e.payload?.restaurantName || e.payload?.orderId || e.payload?.id || ''}
              {e.payload?.eta?.minutes != null ? ` — ETA ${e.payload.eta.minutes} min` : ''}
              {e.payload?.isOpen != null ? ` — ${e.payload.isOpen ? 'open' : 'closed'}` : ''}
            </div>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Live({ tick, events }) {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('live');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [couriers, setCouriers] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [mapsOn, setMapsOn] = useState(true);

  const load = useCallback(async () => {
    try {
      const query = status === 'live' ? '?scope=live' : status === 'all' ? '' : `?status=${status}`;
      const [s, o] = await Promise.all([api.stats(), api.orders(query)]);
      setStats(s);
      setOrders(o.orders);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load, tick]);

  // Positions arrive over the socket, so the roster is read once instead of on every tick.
  useEffect(() => {
    let alive = true;
    Promise.all([api.couriers(), api.restaurants(), api.settings()])
      .then(([c, r, s]) => {
        if (!alive) return;
        setCouriers(c.couriers);
        setKitchens(r.restaurants);
        setMapsOn(Boolean(s.settings.mapsEnabled));
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const latest = events[0];
    if (latest.name === 'courier:location') {
      const p = latest.payload;
      setCouriers((rows) => rows.map((c) => (c.id === p.courierId ? { ...c, lat: p.lat, lng: p.lng, locationUpdatedAt: p.at } : c)));
    }
    if (latest.name === 'courier:presence') {
      const p = latest.payload;
      setCouriers((rows) => rows.map((c) => (c.id === p.id ? { ...c, isOnline: p.isOnline, activeOrders: p.activeOrders } : c)));
    }
    if (latest.name === 'restaurant:availability') {
      const p = latest.payload;
      setKitchens((rows) => rows.map((k) => (k.id === p.id ? { ...k, isOpen: p.isOpen } : k)));
    }
  }, [events]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    api
      .order(openId)
      .then((d) => setDetail(d))
      .catch((err) => setError(err.message));
  }, [openId, tick]);

  const act = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await fn();
      const o = await api.order(openId);
      setDetail(o);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const stale = useMemo(
    () => orders.filter((o) => !TERMINAL.includes(o.status) && ageMinutes(o.timestamps?.placedAt) > 25).length,
    [orders]
  );

  const positioned = useMemo(() => couriers.filter((c) => c.lat != null).length, [couriers]);

  return (
    <>
      <div className="kpis">
        <Kpi label="Orders (24h)" value={stats?.ordersToday ?? '—'} note={`${stats?.activeOrders ?? 0} still in flight`} />
        <Kpi label="Settled revenue" value={stats ? `${money(stats.revenueCents)} ETB` : '—'} note={`${stats?.settledOrders ?? 0} delivered, all time`} />
        <Kpi label="Avg prep" value={stats?.averagePrepMinutes != null ? `${stats.averagePrepMinutes} min` : '—'} note='accept → ready' />
        <Kpi
          label="Couriers"
          value={stats ? `${stats.couriers.online}/${stats.couriers.total}` : '—'}
          note={`${stats?.couriers.carrying ?? 0} carrying a job`}
        />
        <Kpi label="Kitchens open" value={stats ? `${stats.restaurants.open}/${stats.restaurants.total}` : '—'} note='live availability' />
        <Kpi label="Gateway" value={stats?.gateway ?? '—'} note={`${stats?.paymentsFailed ?? 0} failed payments`} />
      </div>

      <Notice text={error} />

      <Panel
        title="City"
        aside={<span className="tiny dim">{positioned} of {couriers.length} couriers positioned</span>}
      >
        <CityMap kitchens={kitchens} couriers={couriers} enabled={mapsOn} height={340} />
      </Panel>

      <div className="split" style={{ marginTop: 20 }}>
        <Panel
          title="Orders"
          scroll
          aside={
            <>
              <Field label="">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="live">In flight</option>
                  <option value="PLACED">Placed</option>
                  <option value="PAID">Paid</option>
                  <option value="PREPARING">Cooking</option>
                  <option value="READY">Ready</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="PICKED_UP">On the road</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Declined</option>
                  <option value="all">Everything</option>
                </select>
              </Field>
              <button className="btn" onClick={() => load()}>
                Refresh
              </button>
            </>
          }
        >
          {!orders.length ? (
            <Empty text="Nothing in this scope." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Kitchen</th>
                  <th>Status</th>
                  <th>ETA</th>
                  <th>Courier</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={openId === o.id ? 'sel' : ''} onClick={() => setOpenId(o.id)}>
                    <td>
                      <div className="num tiny">#{o.id.slice(-6)}</div>
                      <div className="tiny dim">{clock(o.timestamps?.placedAt)}</div>
                    </td>
                    <td>{o.restaurantName}</td>
                    <td>
                      <Badge status={o.status} />
                      {o.offer?.state === 'OFFERED' ? (
                        <div className="tiny dim">offered, waiting</div>
                      ) : null}
                    </td>
                    <td className="num">{o.eta?.minutes != null ? `${o.eta.minutes}m` : '—'}</td>
                    <td className="tiny">{o.courierName || <span className="dim">unassigned</span>}</td>
                    <td className="num">{money(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: 'grid', gap: 20 }}>
          <Panel title={openId ? `Order #${String(openId).slice(-6)}` : 'Order detail'}>
            {!detail ? (
              <Empty text="Pick an order to see its recorded history and the ops actions." />
            ) : (
              <>
                <Flow order={detail.order} />
                <Notice text={detail.order.cancelReason || detail.order.rejectReason || ''} />
                <div className="grid2">
                  <div>
                    <dl>
                      <dt>Kitchen</dt>
                      <dd>{detail.order.restaurantName}</dd>
                      <dt>Customer</dt>
                      <dd>
                        {detail.order.customer?.name} · <span className="num">{detail.order.customer?.phone}</span>
                      </dd>
                      <dt>Address</dt>
                      <dd className="tiny">{detail.order.deliveryAddress?.line}</dd>
                      <dt>Distance</dt>
                      <dd className="num">{distance(detail.order.distanceMeters)}</dd>
                      <dt>Courier</dt>
                      <dd>{detail.order.courierName || '—'}</dd>
                      <dt>Offer</dt>
                      <dd className="tiny">
                        {detail.order.offer?.state} · {detail.order.offer?.attempts || 0} attempt(s)
                      </dd>
                    </dl>
                  </div>
                  <div>
                    <dl>
                      <dt>Payment</dt>
                      <dd>
                        {detail.payment ? (
                          <>
                            <Badge status={detail.payment.status} label={detail.payment.status} />{' '}
                            <span className="num">{money(detail.payment.amountCents)} ETB</span>
                            <div className="tiny dim">
                              {detail.payment.gateway} · {detail.payment.method}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </dd>
                      <dt>Items</dt>
                      <dd className="tiny">
                        {detail.order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      </dd>
                      <dt>Totals</dt>
                      <dd className="num tiny">
                        sub {money(detail.order.subtotalCents)} + del {money(detail.order.deliveryFeeCents)} + svc{' '}
                        {money(detail.order.serviceFeeCents)} = {money(detail.order.totalCents)}
                      </dd>
                      <dt>ETA</dt>
                      <dd className="tiny">{detail.order.eta?.reason || '—'}</dd>
                    </dl>
                  </div>
                </div>

                <div className="actions" style={{ marginTop: 16 }}>
                  {(NEXT[detail.order.status] || []).map((to) => (
                    <button
                      key={to}
                      className={`btn ${to === 'CANCELLED' || to === 'REJECTED' ? 'danger' : ''}`}
                      onClick={() => act(() => api.transition(detail.order.id, to, 'Moved by operations'))}
                    >
                      {to === 'CANCELLED' ? 'Cancel order' : LABEL[to] || to}
                    </button>
                  ))}
                  {['PREPARING', 'READY', 'ASSIGNED'].includes(detail.order.status) && !detail.order.courierId ? (
                    <button className="btn" onClick={() => act(() => api.reassign(detail.order.id))}>
                      Re-open assignment
                    </button>
                  ) : null}
                  {stale ? (
                    <button
                      className="btn"
                      title="Ask the watchdog to look for stuck orders"
                      onClick={() => act(() => api.sweep())}
                    >
                      Sweep for orphans ({stale} over 25 min)
                    </button>
                  ) : null}
                </div>

                <h2 style={{ marginTop: 20 }}>Recorded history</h2>
                <ul className="timeline">
                  {detail.order.statusHistory
                    .slice()
                    .reverse()
                    .map((e, i) => (
                      <li key={`${e.at}-${i}`}>
                        <time>{clock(e.at)}</time>
                        <span>
                          <span className="who">{e.actor}</span>
                          <div>
                            <Badge status={e.status} /> {e.note ? <span className="tiny dim">{e.note}</span> : null}
                          </div>
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Realtime feed">
            <Ticker events={events} />
          </Panel>
        </div>
      </div>
    </>
  );
}
