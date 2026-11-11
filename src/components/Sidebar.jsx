import React from 'react';
import {
  LayoutDashboard, Users, CalendarDays, Wrench, FileText, Wallet, Settings, Hammer,
} from 'lucide-react';

const ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'rdv', label: 'Rendez-vous', icon: CalendarDays },
  { id: 'interventions', label: 'Interventions', icon: Wrench },
  { id: 'devis', label: 'Devis', icon: FileText },
  { id: 'finances', label: 'Finances', icon: Wallet },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
];

export default function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><Hammer size={20} /></div>
        <div>
          <div className="brand-name">Atelier Manager</div>
          <div className="brand-sub">Gestion d'atelier</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">Version 1.0.0</div>
    </aside>
  );
}
