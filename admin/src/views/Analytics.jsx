import React, { useCallback, useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Donut, Share, Trend } from '../charts.jsx';
import { Empty, Kpi, Notice, Panel } from '../components.jsx';

const SOURCE_LABEL = {
  card: 'Card',
  telebirr: 'Telebirr',
  cbebir: 'CBE Birr',
  cash: 'Cash on delivery',
  mock: 'Local gateway (dev)'
};

const etb = (cents) => `${money(cents)} ETB`;

export default function Analytics({ tick }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.analytics(days));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, tick]);

  if (!data) {
    return (
      <>
        <Notice text={error} />
        <Empty text="Loading the ledger…" />
      </>
    );
  }

  const average = data.totals.settledOrders ? Math.round(data.totals.revenueCents / data.totals.settledOrders) : 0;
  const bestDay = data.series.reduce((top, row) => (row.revenueCents > (top?.revenueCents || 0) ? row : top), null);

  return (
    <>
      <div className="kpis">
        <Kpi label="Revenue" value={etb(data.totals.revenueCents)} note={`settled in ${data.days} days`} />
        <Kpi label="Orders placed" value={data.totals.orders} note={`${data.totals.settledOrders} delivered`} />
        <Kpi label="Average order" value={etb(average)} note="per settled order" />
        <Kpi label="Best day" value={bestDay ? etb(bestDay.revenueCents) : '—'} note={bestDay ? bestDay.day : 'no settled orders yet'} />
      </div>

      <Notice text={error} />

      <div className="split">
        <Panel
          title="Revenue trend"
          aside={
            <div className="seg">
              {[7, 14, 30].map((d) => (
                <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
                  {d}d
                </button>
              ))}
            </div>
          }
        >
          <Trend series={data.series} format={etb} />
        </Panel>

        <Panel title="Income by source">
          <Donut
            format={money}
            unit={data.currency}
            caption={`${data.currency} total`}
            slices={data.sources.map((s) => ({ label: SOURCE_LABEL[s.method] || s.method, value: s.amountCents }))}
          />
          <p className="tiny dim" style={{ marginTop: 14 }}>
            Counted from payments that succeeded, so this can lead the settled-order revenue above while a driver is still on the road.
          </p>
        </Panel>
      </div>

      <Panel title="Top kitchens" scroll={false}>
        {!data.topRestaurants.length ? (
          <Empty text="Nothing has settled in this window." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Kitchen</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {data.topRestaurants.map((r) => (
                <tr key={r.restaurantId}>
                  <td>{r.name}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{etb(r.revenueCents)}</td>
                  <td style={{ minWidth: 120 }}>
                    <Share value={r.revenueCents} total={data.totals.revenueCents} tone="accent" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <p className="sub" style={{ marginTop: 14 }}>
        Revenue counts an order once it is delivered, so the last day of any window reads low while a driver is still on the road.
      </p>
    </>
  );
}
