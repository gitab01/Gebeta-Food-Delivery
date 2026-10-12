import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, closeRealtime, readSession, realtime, writeSession } from './api.js';
import { Empty, Field, Notice } from './components.jsx';
import { Brand, Ico, ThemeToggle } from './brand.jsx';
import Live from './views/Live.jsx';
import Restaurants from './views/Restaurants.jsx';
import Couriers from './views/Couriers.jsx';
import Users from './views/Users.jsx';
import Kitchen from './views/Kitchen.jsx';
import Analytics from './views/Analytics.jsx';
import Settings from './views/Settings.jsx';

const VIEWS = [
  { key: 'live', label: 'Live ops', icon: 'pulse', view: Live, roles: ['admin'] },
  { key: 'analytics', label: 'Analytics', icon: 'chart', view: Analytics, roles: ['admin'] },
  { key: 'restaurants', label: 'Kitchens', icon: 'store', view: Restaurants, roles: ['admin'] },
  { key: 'couriers', label: 'Couriers', icon: 'bike', view: Couriers, roles: ['admin'] },
  { key: 'users', label: 'Accounts', icon: 'users', view: Users, roles: ['admin'] },
  { key: 'settings', label: 'Settings', icon: 'sliders', view: Settings, roles: ['admin'] },
  // The same web app is the kitchen's console when an owner signs in, so the
  // restaurant-role API has a real client instead of a theoretical one.
  { key: 'kitchen', label: 'Kitchen queue', icon: 'flame', view: Kitchen, roles: ['restaurant'] }
];

function Login({ onDone }) {
  const [phone, setPhone] = useState('0900000001');
  const [password, setPassword] = useState('gebeta123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.login(phone.trim(), password);
      if (!['admin', 'restaurant'].includes(user.role)) {
        throw new Error('This console is for operators and kitchen owners.');
      }
      const session = { token, user };
      writeSession(session);
      onDone(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <Brand />
        <p className="sub">Operator console for the delivery marketplace.</p>
        <Notice text={error} />
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn dark" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(readSession());
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState([]);
  const debounce = useRef(null);

  const allowed = useMemo(
    () => VIEWS.filter((v) => v.roles.includes(session?.user?.role)),
    [session]
  );
  const [tab, setTab] = useState('live');
  const active = allowed.find((v) => v.key === tab) || allowed[0];

  useEffect(() => {
    if (!session?.token) return undefined;
    const socket = realtime();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const bump = (name) => (payload) => {
      setEvents((current) => [{ name, payload, at: new Date() }, ...current].slice(0, 30));
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => setTick((t) => t + 1), 350);
    };

    const watched = [
      'admin:order',
      'restaurant:order',
      'order:new',
      'order:eta',
      'courier:presence',
      'courier:location',
      'restaurant:availability',
      'restaurant:menu',
      'assignment:offered',
      'assignment:exhausted',
      'watchdog:sweep'
    ];
    watched.forEach((name) => socket.on(name, bump(name)));
    return () => {
      watched.forEach((name) => socket.off(name));
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [session?.token]);

  const logout = useCallback(() => {
    closeRealtime();
    writeSession(null);
    setSession(null);
  }, []);

  if (!session?.token) return <Login onDone={setSession} />;

  return (
    <div className="shell">
      <header className="topbar">
        <Brand />
        <nav className="nav">
          {allowed.map((v) => (
            <button key={v.key} className={active?.key === v.key ? 'on' : ''} onClick={() => setTab(v.key)}>
              <Ico name={v.icon} />
              <span className="label">{v.label}</span>
            </button>
          ))}
        </nav>
        <ThemeToggle />
        <span className={`live ${connected ? 'on' : ''}`}>
          <i />
          {connected ? 'realtime' : 'reconnecting'}
        </span>
        <button className="ghost" onClick={logout} title={session.user.name}>
          sign out
        </button>
      </header>

      <main className="main">
        {active ? <active.view tick={tick} events={events} user={session.user} /> : <Empty text="No console for this role." />}
      </main>
    </div>
  );
}
