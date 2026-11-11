import React, { useEffect, useState } from 'react';
import { Users, CalendarCheck, Wrench, FileText, ArrowRight, Clock } from 'lucide-react';
import { api, clientName, formatDate } from '../lib/format.js';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats().then(setStats);
  }, []);

  if (!stats) {
    return <div className="page-loading">Chargement…</div>;
  }

  const cards = [
    { label: 'Clients', value: stats.clients, icon: Users, page: 'clients', color: 'blue' },
    { label: 'Rendez-vous aujourd’hui', value: stats.rdvToday, icon: CalendarCheck, page: 'rdv', color: 'green' },
    { label: 'Interventions en cours', value: stats.interventionsEnCours, icon: Wrench, page: 'interventions', color: 'orange' },
    { label: 'Devis en attente', value: stats.devisEnCours, icon: FileText, page: 'devis', color: 'violet' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p className="page-subtitle">Vue d’ensemble de votre activité</p>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon, page: p, color }) => (
          <button key={label} type="button" className={`stat-card stat-${color}`} onClick={() => onNavigate(p)}>
            <div className="stat-icon"><Icon size={22} /></div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Derniers clients ajoutés</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('clients')}>
            Voir tous les clients <ArrowRight size={15} />
          </button>
        </div>
        {stats.derniersClients.length === 0 ? (
          <div className="empty-inline">
            <p>Aucun client pour le moment.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('clients')}>
              Ajouter un premier client
            </button>
          </div>
        ) : (
          <div className="list-rows">
            {stats.derniersClients.map((c) => (
              <div key={c.id} className="list-row">
                <div className="row-title">{clientName(c)}</div>
                <div className="row-sub">{c.ville || '—'}</div>
                <div className="row-meta"><Clock size={13} /> {formatDate(c.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
