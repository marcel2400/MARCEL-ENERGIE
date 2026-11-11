import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, Phone, Mail, MapPin, User, AlertTriangle,
  CalendarDays, Wrench, FileText, Building2, MapPinned,
} from 'lucide-react';
import Modal from '../components/Modal.jsx';
import Confirm from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { useDebounced } from '../lib/hooks.js';
import { api, clientName, initials, formatDate } from '../lib/format.js';

const EMPTY_FORM = {
  id: null,
  civilite: '',
  nom: '',
  prenom: '',
  telephone: '',
  email: '',
  adresse: '',
  code_postal: '',
  ville: '',
  departement: '',
  notes: '',
};

function AddressAutocomplete({ value, onSelect, onDataPick }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebounced(query, 160);
  const boxRef = useRef(null);
  const skipRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (skipRef.current) {
      skipRef.current = false;
      return undefined;
    }
    if (debounced.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    api.adresseSearch(debounced.trim()).then((r) => {
      if (!cancelled) {
        setSuggestions(r);
        setOpen(r.length > 0);
        setHighlight(0);
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

  const choose = (s) => {
    skipRef.current = true;
    setQuery(s.adresse || s.ville || '');
    setOpen(false);
    onSelect(s);
  };

  const onKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(suggestions[highlight]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="autocomplete" ref={boxRef}>
      <div className="input-wrap">
        <MapPin size={15} className="input-icon" />
        <input
          className="field-input has-icon"
          placeholder="Adresse, ville ou code postal…"
          value={open ? query : value}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onKeyDown={onKey}
        />
      </div>
      {open ? (
        <div className="autocomplete-list">
          {suggestions.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              className={`autocomplete-item ${i === highlight ? 'active' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(s)}
            >
              {s.type === 'adresse' ? <MapPinned size={14} /> : <Building2 size={14} />}
              <span className="ac-label">{s.label}</span>
              {s.departementNom ? <span className="ac-sub">{s.departementNom}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {onDataPick ? null : null}
    </div>
  );
}

function ClientForm({ open, initial, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [duplicates, setDuplicates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debouncedDupCheck = useDebounced(`${form.nom}|${form.prenom}|${form.telephone}`, 350);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
      setDuplicates([]);
      setError('');
    }
  }, [open, initial]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !form.nom.trim()) {
      setDuplicates([]);
      return undefined;
    }
    api.clientDuplicates(form, form.id).then((d) => {
      if (!cancelled) setDuplicates(d);
    });
    return () => { cancelled = true; };
  }, [debouncedDupCheck, open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickAddress = (s) => {
    setForm((f) => ({
      ...f,
      adresse: s.adresse || f.adresse,
      ville: s.ville || f.ville,
      code_postal: s.codePostal || f.code_postal,
      departement: s.departementNom || s.departement || f.departement,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      await api.clientSave(form);
      toast(initial && initial.id ? 'Client modifié.' : 'Client ajouté.');
      onSaved();
    } catch (err) {
      setError(String(err.message || err).replace(/^Error: /, ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial && initial.id ? 'Modifier le client' : 'Nouveau client'}
      subtitle="Les champs marqués d’un astérisque sont obligatoires"
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" form="client-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="client-form" className="form-grid" onSubmit={submit}>
        {duplicates.length ? (
          <div className="dup-warning">
            <AlertTriangle size={16} />
            <div>
              <strong>Possible doublon détecté :</strong>
              <ul>
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {clientName(d)} — {d.raison}{d.ville ? ` · ${d.ville}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="form-row">
          <label className="field" style={{ maxWidth: 130 }}>
            <span className="field-label">Civilité</span>
            <select className="field-input" value={form.civilite} onChange={set('civilite')}>
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="SARL">SARL</option>
              <option value="EURL">EURL</option>
              <option value="Association">Association</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Nom *</span>
            <input className="field-input" value={form.nom} onChange={set('nom')} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Prénom</span>
            <input className="field-input" value={form.prenom} onChange={set('prenom')} />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Téléphone</span>
            <input className="field-input" value={form.telephone} onChange={set('telephone')} placeholder="06 12 34 56 78" />
          </label>
          <label className="field">
            <span className="field-label">E-mail</span>
            <input className="field-input" type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>

        <div className="field">
          <span className="field-label">Adresse</span>
          <AddressAutocomplete value={form.adresse} onSelect={pickAddress} />
        </div>

        <div className="form-row">
          <label className="field" style={{ maxWidth: 150 }}>
            <span className="field-label">Code postal</span>
            <input className="field-input" value={form.code_postal} onChange={set('code_postal')} />
          </label>
          <label className="field">
            <span className="field-label">Ville</span>
            <input
              className="field-input"
              value={form.ville}
              onChange={set('ville')}
              list="villes-list"
            />
          </label>
          <label className="field" style={{ maxWidth: 170 }}>
            <span className="field-label">Département</span>
            <input className="field-input" value={form.departement} onChange={set('departement')} />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Notes</span>
          <textarea className="field-input" rows={3} value={form.notes} onChange={set('notes')} />
        </label>

        {error ? <div className="form-error">{error}</div> : null}
      </form>
    </Modal>
  );
}

function ClientDetail({ open, clientId, onClose, onEdit, onDeleted }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('infos');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && clientId) {
      api.clientGet(clientId).then(setData);
      setTab('infos');
    } else {
      setData(null);
    }
  }, [open, clientId]);

  if (!open) return null;

  const doDelete = async () => {
    await api.clientDelete(clientId);
    setConfirmDelete(false);
    toast('Client supprimé.');
    onDeleted();
  };

  const c = data ? data.client : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={c ? clientName(c) : 'Client'}
      subtitle={c ? `Client depuis le ${formatDate(c.created_at)}` : ''}
      width={760}
      footer={
        c ? (
          <>
            <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Supprimer
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(c)}>
              <Pencil size={15} /> Modifier
            </button>
          </>
        ) : null
      }
    >
      {!c ? (
        <p>Chargement…</p>
      ) : (
        <>
          <div className="detail-head">
            <div className="avatar avatar-lg">{initials(c)}</div>
            <div className="detail-head-info">
              <div className="detail-name">{clientName(c)}</div>
              <div className="detail-addr">
                {[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' '), c.departement].filter(Boolean).join(' · ') || 'Adresse non renseignée'}
              </div>
            </div>
          </div>

          <div className="tabs">
            {[
              { id: 'infos', label: 'Informations', icon: User },
              { id: 'rdvs', label: `Rendez-vous (${data.rdvs.length})`, icon: CalendarDays },
              { id: 'interventions', label: `Interventions (${data.interventions.length})`, icon: Wrench },
              { id: 'devis', label: `Devis (${data.devis.length})`, icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {tab === 'infos' ? (
            <div className="kv kv-detail">
              <div className="kv-row">
                <span className="kv-key"><Phone size={14} /> Téléphone</span>
                <span className="kv-value">
                  {c.telephone
                    ? <a className="link" href={`tel:${c.telephone.replace(/\s/g, '')}`}>{c.telephone}</a>
                    : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key"><Mail size={14} /> E-mail</span>
                <span className="kv-value">
                  {c.email
                    ? <a className="link" href={`mailto:${c.email}`}>{c.email}</a>
                    : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key"><MapPin size={14} /> Adresse</span>
                <span className="kv-value">{[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key"><Building2 size={14} /> Département</span>
                <span className="kv-value">{c.departement || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Notes</span>
                <span className="kv-value">{c.notes || '—'}</span>
              </div>
            </div>
          ) : null}

          {tab === 'rdvs' ? (
            data.rdvs.length === 0
              ? <p className="empty-inline">Aucun rendez-vous enregistré pour ce client.</p>
              : (
                <div className="list-rows">
                  {data.rdvs.map((r) => (
                    <div key={r.id} className="list-row">
                      <div className="row-title">{r.titre}</div>
                      <div className="row-sub">{formatDate(r.date_debut)}</div>
                      <span className={`badge badge-rdv-${r.statut}`}>{r.statut}</span>
                    </div>
                  ))}
                </div>
              )
          ) : null}

          {tab === 'interventions' ? (
            data.interventions.length === 0
              ? <p className="empty-inline">Aucune intervention enregistrée pour ce client.</p>
              : (
                <div className="list-rows">
                  {data.interventions.map((i) => (
                    <div key={i.id} className="list-row">
                      <div className="row-title">{i.titre}</div>
                      <div className="row-sub">{i.description?.slice(0, 80)}</div>
                      <span className={`badge badge-int-${i.statut}`}>{i.statut}</span>
                    </div>
                  ))}
                </div>
              )
          ) : null}

          {tab === 'devis' ? (
            data.devis.length === 0
              ? <p className="empty-inline">Aucun devis enregistré pour ce client.</p>
              : (
                <div className="list-rows">
                  {data.devis.map((d) => (
                    <div key={d.id} className="list-row">
                      <div className="row-title">{d.numero}</div>
                      <div className="row-sub">{formatDate(d.date_devis)}</div>
                      <span className={`badge badge-devis-${d.statut}`}>{d.statut}</span>
                    </div>
                  ))}
                </div>
              )
          ) : null}
        </>
      )}

      <Confirm
        open={confirmDelete}
        title="Supprimer ce client ?"
        message={`Le client « ${c ? clientName(c) : ''} » et tout son historique associé (rendez-vous, interventions, devis) seront définitivement supprimés.`}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}

export default function Clients({ openClientId, onClearOpenClient }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const debouncedQuery = useDebounced(query, 120);

  const load = useCallback(async (q) => {
    setLoading(true);
    setRows(await api.clientsList(q));
    setLoading(false);
  }, []);

  useEffect(() => { load(debouncedQuery); }, [debouncedQuery, load]);

  useEffect(() => {
    if (openClientId) {
      setDetailId(openClientId);
      onClearOpenClient();
    }
  }, [openClientId, onClearOpenClient]);

  const saved = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    load(debouncedQuery);
  }, [load, debouncedQuery]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c) => { setDetailId(null); setEditing(c); setFormOpen(true); };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p className="page-subtitle">
            {loading ? 'Recherche…' : `${rows.length} client${rows.length > 1 ? 's' : ''}`}
            {debouncedQuery ? ` — résultats pour « ${debouncedQuery} »` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      <div className="search-bar">
        <Search size={17} className="search-icon" />
        <input
          className="search-input"
          placeholder="Rechercher : nom, prénom, téléphone, e-mail, adresse, ville, code postal, département…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => setQuery('')}>✕</button>
        ) : null}
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="page-loading">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <User size={36} />
            <h3>{debouncedQuery ? 'Aucun client trouvé' : 'Aucun client'}</h3>
            <p>{debouncedQuery ? 'Essayez avec un autre terme (nom, téléphone, ville…).' : 'Ajoutez votre premier client pour commencer.'}</p>
            {!debouncedQuery ? (
              <button type="button" className="btn btn-primary" onClick={openNew}>
                <Plus size={16} /> Nouveau client
              </button>
            ) : null}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th>E-mail</th>
                <th>Ville</th>
                <th>CP</th>
                <th>Dépt.</th>
                <th className="th-actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setDetailId(c.id)}>
                  <td>
                    <div className="cell-client">
                      <div className="avatar">{initials(c)}</div>
                      <div>
                        <div className="cell-name">{clientName(c)}</div>
                        <div className="cell-sub">{c.civilite}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{c.telephone || '—'}</td>
                  <td className="cell-muted">{c.email || '—'}</td>
                  <td>{c.ville || '—'}</td>
                  <td className="mono">{c.code_postal || '—'}</td>
                  <td>{c.departement || '—'}</td>
                  <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="icon-btn" title="Modifier" onClick={() => openEdit(c)}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ClientForm
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={saved}
      />

      <ClientDetail
        open={!!detailId}
        clientId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onDeleted={() => { setDetailId(null); load(debouncedQuery); }}
      />
    </div>
  );
}
