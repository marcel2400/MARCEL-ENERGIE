import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, User, CalendarDays, Wrench, FileText, X } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Parametres from './pages/Parametres.jsx';
import Placeholder from './pages/Placeholder.jsx';
import { useDebounced } from './lib/hooks.js';
import { api, clientName } from './lib/format.js';

const PLACEHOLDERS = {
  rdv: {
    title: 'Rendez-vous',
    text: "Le module Rendez-vous (calendrier jour / semaine / mois, statuts, rappels) sera activé à l'étape suivante du développement.",
    icon: CalendarDays,
  },
  interventions: {
    title: 'Interventions',
    text: "Le module Interventions (fiches, photos, documents, suivi des états) sera activé à l'étape suivante du développement.",
    icon: Wrench,
  },
  devis: {
    title: 'Devis',
    text: "Le module Devis (numérotation, calculs HT/TVA/TTC, PDF) sera activé à l'étape suivante du développement.",
    icon: FileText,
  },
  finances: {
    title: 'Finances',
    text: "Le module Finances (recettes, dépenses, suivi) sera activé à l'étape suivante du développement.",
    icon: FileText,
  },
};

function GlobalSearch({ onOpenClient }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 140);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return undefined;
    }
    api.globalSearch(debounced.trim()).then((r) => {
      if (!cancelled) {
        setResults(r);
        setOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, [debounced]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const total = results
    ? results.clients.length + results.rdvs.length + results.interventions.length + results.devis.length
    : 0;

  const pickClient = (id) => {
    onOpenClient(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="global-search" ref={boxRef}>
      <Search size={16} className="gs-icon" />
      <input
        className="gs-input"
        placeholder="Rechercher partout : client, téléphone, ville, rendez-vous, devis…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results) setOpen(true); }}
      />
      {query ? (
        <button type="button" className="gs-clear" onClick={() => { setQuery(''); setResults(null); }}>
          <X size={14} />
        </button>
      ) : null}
      {open && results ? (
        <div className="gs-dropdown">
          {total === 0 ? <div className="gs-empty">Aucun résultat</div> : null}
          {results.clients.length ? (
            <div className="gs-group">
              <div className="gs-group-title">Clients</div>
              {results.clients.map((c) => (
                <button key={`c${c.id}`} type="button" className="gs-item" onClick={() => pickClient(c.id)}>
                  <User size={15} />
                  <span className="gs-main">{clientName(c)}</span>
                  <span className="gs-sub">{[c.telephone, c.ville].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          ) : null}
          {results.rdvs.length ? (
            <div className="gs-group">
              <div className="gs-group-title">Rendez-vous</div>
              {results.rdvs.map((r) => (
                <div key={`r${r.id}`} className="gs-item gs-static">
                  <CalendarDays size={15} />
                  <span className="gs-main">{r.titre}</span>
                  <span className="gs-sub">{r.client_nom || ''}</span>
                </div>
              ))}
            </div>
          ) : null}
          {results.interventions.length ? (
            <div className="gs-group">
              <div className="gs-group-title">Interventions</div>
              {results.interventions.map((i) => (
                <div key={`i${i.id}`} className="gs-item gs-static">
                  <Wrench size={15} />
                  <span className="gs-main">{i.titre}</span>
                  <span className="gs-sub">{i.client_nom || ''}</span>
                </div>
              ))}
            </div>
          ) : null}
          {results.devis.length ? (
            <div className="gs-group">
              <div className="gs-group-title">Devis</div>
              {results.devis.map((d) => (
                <div key={`d${d.id}`} className="gs-item gs-static">
                  <FileText size={15} />
                  <span className="gs-main">{d.numero}</span>
                  <span className="gs-sub">{d.client_nom || ''}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [openClientId, setOpenClientId] = useState(null);

  const openClient = useCallback((id) => {
    setOpenClientId(id);
    setPage('clients');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.querySelector('.gs-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar page={page} onNavigate={setOpenClientId ? (p) => { setOpenClientId(null); setPage(p); } : setPage} />
        <div className="app-main">
          <header className="topbar">
            <GlobalSearch onOpenClient={openClient} />
          </header>
          <main className="app-content">
            {page === 'dashboard' ? <Dashboard onNavigate={setPage} /> : null}
            {page === 'clients' ? (
              <Clients openClientId={openClientId} onClearOpenClient={() => setOpenClientId(null)} />
            ) : null}
            {page === 'parametres' ? <Parametres /> : null}
            {PLACEHOLDERS[page] ? (
              <Placeholder title={PLACEHOLDERS[page].title} text={PLACEHOLDERS[page].text} Icon={PLACEHOLDERS[page].icon} />
            ) : null}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
