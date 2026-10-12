import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, money } from '../api.js';
import { Badge, Empty, Field, Kpi, Notice, Panel } from '../components.jsx';

export default function Restaurants({ tick }) {
  const [list, setList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const { restaurants } = await api.restaurants();
      setList(restaurants);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const picked = useMemo(() => list.find((r) => r.id === openId) || null, [list, openId]);

  const patch = async (id, body, note) => {
    try {
      setSaved('');
      await api.patchRestaurant(id, body);
      await load();
      setSaved(note);
    } catch (err) {
      setError(err.message);
    }
  };

  const closed = list.filter((r) => !r.isOpen).length;
  const slowest = [...list].sort((a, b) => b.avgPrepMinutes - a.avgPrepMinutes)[0];

  return (
    <>
      <div className="kpis">
        <Kpi label="Kitchens" value={list.length} note={`${closed} closed right now`} />
        <Kpi label="Open now" value={list.length - closed} note='accepting orders' />
        <Kpi label="Slowest" value={slowest ? `${slowest.avgPrepMinutes} min` : '—'} note={slowest?.name || ''} />
      </div>

      <Notice text={error} />
      <Notice kind="ok" text={saved} />

      <div className="split">
        <Panel title="Kitchens" scroll>
          {!list.length ? (
            <Empty text="No kitchens registered yet." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cuisine</th>
                  <th>State</th>
                  <th>Avg prep</th>
                  <th>Rating</th>
                  <th>Menu</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const items = r.menu.reduce((n, s) => n + s.items.length, 0);
                  const off = r.menu.reduce((n, s) => n + s.items.filter((i) => !i.available).length, 0);
                  return (
                    <tr key={r.id} className={openId === r.id ? 'sel' : ''} onClick={() => setOpenId(r.id)}>
                      <td>
                        <div className="row">
                          <span aria-hidden="true">{r.emoji}</span>
                          <span>
                            <div>{r.name}</div>
                            <div className="tiny dim">{r.address}</div>
                          </span>
                        </div>
                      </td>
                      <td className="tiny">{r.cuisine}</td>
                      <td>
                        <Badge status={r.isOpen ? 'COMPLETED' : 'CANCELLED'} label={r.isOpen ? 'Open' : 'Closed'} />
                      </td>
                      <td className="num">{r.avgPrepMinutes}m</td>
                      <td className="num">
                        {r.ratingCount ? `${r.ratingStars.toFixed(1)} (${r.ratingCount})` : '—'}
                      </td>
                      <td className="tiny num">
                        {items} items
                        {off ? <span className="dim"> · {off} unavailable</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: 'grid', gap: 20 }}>
          <Panel title={picked ? picked.name : 'Kitchen settings'}>
            {!picked ? (
              <Empty text="Pick a kitchen to open or close it and tune its delivery rules." />
            ) : (
              <>
                <p className="sub">{picked.description}</p>
                <dl>
                  <dt>Contact</dt>
                  <dd className="num tiny">{picked.phone}</dd>
                  <dt>Location</dt>
                  <dd className="num tiny">
                    {picked.lat?.toFixed(4)}, {picked.lng?.toFixed(4)}
                  </dd>
                  <dt>Radius</dt>
                  <dd className="num">{(picked.deliveryRadiusMeters / 1000).toFixed(1)} km</dd>
                </dl>

                <div className="actions" style={{ marginTop: 16 }}>
                  <button
                    className={`btn ${picked.isOpen ? 'danger' : 'dark'}`}
                    onClick={() => patch(picked.id, { isOpen: !picked.isOpen }, `${picked.name} is now ${picked.isOpen ? 'closed' : 'open'}.`)}
                  >
                    {picked.isOpen ? 'Close kitchen' : 'Open kitchen'}
                  </button>
                </div>
                <p className="tiny dim" style={{ marginTop: 8 }}>
                  Closing stops new carts at the API, but orders already in the queue stay live.
                </p>

                <div className="grid2" style={{ marginTop: 18 }}>
                  <Field label="Base prep (minutes)">
                    <input
                      key={`${picked.id}-prep`}
                      type="number"
                      min={5}
                      defaultValue={picked.avgPrepMinutes}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v !== picked.avgPrepMinutes) {
                          patch(picked.id, { basePrepMinutes: v }, `Prep base set to ${v} minutes.`);
                        }
                      }}
                    />
                  </Field>
                  <Field label="Minimum order (ETB)">
                    <input
                      key={`${picked.id}-min`}
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={money(picked.minOrderCents)}
                      onBlur={(e) => {
                        const cents = Math.round(Number(e.target.value) * 100);
                        if (Number.isFinite(cents) && cents !== picked.minOrderCents) {
                          patch(picked.id, { minOrderCents: cents }, `Minimum order set to ${money(cents)} ETB.`);
                        }
                      }}
                    />
                  </Field>
                </div>
                <p className="tiny dim">
                  The rolling average that feeds every ETA is learned from this kitchen's own orders, so the base
                  number only seeds the first few.
                </p>
              </>
            )}
          </Panel>

          <Panel title="Menu availability" scroll>
            {!picked ? (
              <Empty text="Menu appears once you pick a kitchen." />
            ) : (
              picked.menu.map((section) => (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  <h2>{section.name}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Price</th>
                        <th>Prep</th>
                        <th>State</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
            <p className="tiny dim" style={{ padding: '0 16px 12px' }}>
              Kitchens toggle their own items from the kitchen console; this view is read-only for operations.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
