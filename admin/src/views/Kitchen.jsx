import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ageMinutes, api, clock, money } from '../api.js';
import { Badge, Empty, Notice, Panel } from '../components.jsx';

const COLUMNS = [
  { key: 'incoming', title: 'Incoming', statuses: ['PAID'], hint: 'Accept before the courier is dispatched' },
  { key: 'cooking', title: 'Cooking', statuses: ['PREPARING'], hint: 'Assignment is already open for these' },
  { key: 'waiting', title: 'Ready for pickup', statuses: ['READY', 'ASSIGNED', 'PICKED_UP'], hint: 'Handed to the courier' }
];

function OrderCard({ order, onAction, busy }) {
  const placed = ageMinutes(order.timestamps?.placedAt);
  return (
    <article className="panel" style={{ marginBottom: 12 }}>
      <div className="body">
        <div className="row spread">
          <div>
            <div className="num" style={{ fontWeight: 600 }}>#{String(order.id).slice(-6)}</div>
            <div className="tiny dim">{placed != null ? `${placed} min ago` : ''}</div>
          </div>
          <Badge status={order.status} />
        </div>

        <ul className="items">
          {order.items.map((i) => (
            <li key={i.name}>
              <span className="num">{i.qty}×</span> {i.emoji ? `${i.emoji} ` : ''}
              {i.name}
              <span className="tiny dim"> · {money(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>

        <div className="row spread" style={{ marginTop: 6 }}>
          <span className="num" style={{ fontWeight: 600 }}>{money(order.totalCents)} ETB</span>
          {order.eta?.minutes != null ? <span className="tiny dim">ETA {order.eta.minutes} min</span> : null}
        </div>

        {order.notes ? (
          <p className="tiny" style={{ marginTop: 8 }}>
            <b>Note:</b> {order.notes}
          </p>
        ) : null}

        {order.status === 'PREPARING' || order.status === 'READY' ? (
          <p className="tiny dim" style={{ marginTop: 6 }}>
            {order.courierName
              ? `${order.courierName} has this job`
              : order.offer?.state === 'OFFERED'
                ? `seeking a courier — ${order.offer.attempts} offer(s) sent`
                : 'awaiting dispatch'}
          </p>
        ) : null}

        <div className="actions" style={{ marginTop: 12 }}>
          {order.status === 'PAID' ? (
            <>
              <button className="btn dark" disabled={busy} onClick={() => onAction(order, 'accept')}>
                Start cooking
              </button>
              <button className="btn danger" disabled={busy} onClick={() => onAction(order, 'reject')}>
                Decline
              </button>
            </>
          ) : null}
          {order.status === 'PREPARING' ? (
            <button className="btn dark" disabled={busy} onClick={() => onAction(order, 'ready')}>
              Mark ready
            </button>
          ) : null}
          {order.status === 'PICKED_UP' ? (
            <span className="tiny dim">Collected at {clock(order.timestamps?.pickedUpAt)} — out for delivery</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function Kitchen({ tick, events }) {
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ restaurant: r }, { orders: list }] = await Promise.all([api.owner.me(), api.owner.orders('live')]);
      setRestaurant(r);
      setOrders(list);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  /** The kitchen's own queue moves on `restaurant:order`; nothing here polls. */
  useEffect(() => {
    if (!events.length) return;
    const latest = events[0];
    if (latest.name === 'restaurant:order' && latest.payload?.id) {
      setOrders((current) => {
        const idx = current.findIndex((o) => o.id === latest.payload.id);
        if (idx === -1) return [latest.payload, ...current];
        const next = current.slice();
        next[idx] = latest.payload;
        return next;
      });
    }
  }, [events]);

  const action = async (order, kind) => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'reject') {
        const reason = window.prompt('Why can you not take this order?', 'We ran out of an ingredient');
        if (!reason) return;
        await api.owner.reject(order.id, reason);
        setSaved(`Order #${String(order.id).slice(-6)} declined; the customer is refunded.`);
      } else {
        await api.owner[kind](order.id);
        setSaved(
          kind === 'accept'
            ? `Cooking #${String(order.id).slice(-6)} — couriers are now being offered the job.`
            : `#${String(order.id).slice(-6)} is ready for pickup.`
        );
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = async () => {
    try {
      setSaved('');
      const { restaurant: r } = await api.owner.setOpen(!restaurant.isOpen);
      setRestaurant(r);
      setSaved(r.isOpen ? 'You are open: customers can order now.' : 'You are closed: new carts are blocked.');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleItem = async (item) => {
    try {
      setSaved('');
      const { menu } = await api.owner.setItem(item.id, { available: !item.available });
      setRestaurant((r) => ({ ...r, menu }));
      setSaved(`${item.name} is now ${item.available ? 'sold out' : 'available'}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const byStatus = useMemo(() => {
    const map = {};
    for (const o of orders) (map[o.status] ||= []).push(o);
    return map;
  }, [orders]);

  if (!restaurant) {
    return (
      <>
        <Notice text={error} />
        <Empty text={error ? 'Could not load your kitchen.' : 'Loading your kitchen…'} />
      </>
    );
  }

  const incoming = byStatus.PAID || [];
  const cooking = byStatus.PREPARING || [];
  const oldestCooking = cooking.length ? ageMinutes(cooking[cooking.length - 1].timestamps?.acceptedAt) : null;

  return (
    <>
      <Panel title="Service">
        <div className="row spread wrap">
          <div>
            <h2 style={{ marginBottom: 2 }}>
              {restaurant.emoji} {restaurant.name}
            </h2>
            <p className="tiny dim" style={{ margin: 0 }}>
              {restaurant.cuisine} · average prep {restaurant.avgPrepMinutes} min · minimum{' '}
              {money(restaurant.minOrderCents)} ETB
            </p>
          </div>
          <div className="row">
            <Badge
              status={restaurant.isOpen ? 'COMPLETED' : 'CANCELLED'}
              label={restaurant.isOpen ? 'Open' : 'Closed'}
            />
            <button className={`btn ${restaurant.isOpen ? 'danger' : 'dark'}`} onClick={toggleOpen}>
              {restaurant.isOpen ? 'Close service' : 'Open service'}
            </button>
          </div>
        </div>
        <Notice text={error} />
        <Notice kind="ok" text={saved} />
        <div className="row spread" style={{ marginTop: 12 }}>
          <span className="tiny dim">
            {incoming.length} waiting to be accepted · {cooking.length} cooking
          </span>
          {oldestCooking != null && oldestCooking > restaurant.avgPrepMinutes ? (
            <span className="badge ready">
              <i />
              running {oldestCooking - restaurant.avgPrepMinutes} min past the usual prep time
            </span>
          ) : null}
        </div>
      </Panel>

      <div className="queue" style={{ marginTop: 20 }}>
        {COLUMNS.map((col) => {
          const list = col.statuses.flatMap((s) => byStatus[s] || []);
          return (
            <section key={col.key}>
              <header className="queue-head">
                <h2>
                  {col.title} <span className="num dim">{list.length}</span>
                </h2>
                <p className="tiny dim">{col.hint}</p>
              </header>
              {!list.length ? <Empty text="Nothing here." /> : null}
              {list.map((o) => (
                <OrderCard key={o.id} order={o} onAction={action} busy={busy} />
              ))}
            </section>
          );
        })}
      </div>

      <Panel title="Menu" scroll>
        <p className="tiny dim" style={{ marginBottom: 12 }}>
          Marking an item sold out stops it being added to new carts. Orders already in the queue are unaffected.
        </p>
        {restaurant.menu.map((section) => (
          <div key={section.id} style={{ marginBottom: 16 }}>
            <h2>{section.name}</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Prep</th>
                  <th>State</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.emoji} {item.name}
                    </td>
                    <td className="num">{money(item.priceCents)}</td>
                    <td className="num">{item.prepMinutes}m</td>
                    <td>
                      <span className={`badge ${item.available ? 'completed' : 'cancelled'}`}>
                        <i />
                        {item.available ? 'Available' : 'Sold out'}
                      </span>
                    </td>
                    <td>
                      <button className="btn" onClick={() => toggleItem(item)}>
                        {item.available ? 'Mark sold out' : 'Make available'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Panel>
    </>
  );
}
