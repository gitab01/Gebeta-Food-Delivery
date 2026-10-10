import React, { useCallback, useEffect, useState } from 'react';
import { api, clock } from '../api.js';
import { Badge, Empty, Field, Kpi, Notice, Panel } from '../components.jsx';

const ROLES = ['', 'customer', 'courier', 'restaurant', 'admin'];

export default function Users({ tick }) {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async () => {
      try {
        const data = await api.users({ role, q: term });
        setUsers(data.users);
        setError('');
      } catch (err) {
        setError(err.message);
      }
    },
    [role, term]
  );

  useEffect(() => {
    load();
  }, [load, tick]);

  const toggle = async (user) => {
    try {
      setSaved('');
      await api.setUserBlock(user.id, !user.isBlocked);
      await load();
      setSaved(`${user.name} is now ${user.isBlocked ? 'active' : 'suspended'}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const blocked = users.filter((u) => u.isBlocked).length;

  return (
    <>
      <div className="kpis">
        <Kpi label="Accounts" value={users.length} note={role ? `${role} only` : 'all roles'} />
        <Kpi label="Suspended" value={blocked} note='cannot sign in' />
        <Kpi label="Customers" value={users.filter((u) => u.role === 'customer').length} note={q ? `matching “${q}”` : 'in this result set'} />
      </div>

      <Notice text={error} />
      <Notice kind="ok" text={saved} />

      <Panel
        title="Accounts"
        scroll
        aside={
          <>
            <Field label="">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r || 'all'} value={r}>
                    {r ? r : 'All roles'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="">
              <input
                placeholder="Phone or name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: 200 }}
              />
            </Field>
          </>
        }
      >
        {!users.length ? (
          <Empty text="No account matches this filter." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last sign-in</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="num">{u.phone}</td>
                  <td className="tiny">{u.role}</td>
                  <td className="tiny dim">{clock(u.createdAt)}</td>
                  <td className="tiny dim">{u.lastLoginAt ? clock(u.lastLoginAt) : 'never'}</td>
                  <td>
                    <Badge status={u.isBlocked ? 'CANCELLED' : 'COMPLETED'} label={u.isBlocked ? 'Suspended' : 'Active'} />
                  </td>
                  <td>
                    <button className={`btn ${u.isBlocked ? 'dark' : 'danger'}`} onClick={() => toggle(u)}>
                      {u.isBlocked ? 'Reinstate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="tiny dim" style={{ padding: '12px 16px' }}>
          Suspension blocks sign-in and every API call with that token immediately, because the auth middleware re-reads
          the account on each request. Kitchen owners and couriers keep their linked profile; suspending them simply
          stops them working the queue.
        </p>
      </Panel>
    </>
  );
}
