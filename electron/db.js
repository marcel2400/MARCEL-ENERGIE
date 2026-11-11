'use strict';

const { DatabaseSync } = require('node:sqlite');

function norm(value) {
  return (value == null ? '' : String(value))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value) {
  return (value == null ? '' : String(value)).replace(/\D+/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civilite TEXT NOT NULL DEFAULT '',
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  code_postal TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  departement TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  search_norm TEXT NOT NULL DEFAULT '',
  tel_norm TEXT NOT NULL DEFAULT '',
  name_norm TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_search ON clients(search_norm);
CREATE INDEX IF NOT EXISTS idx_clients_tel ON clients(tel_norm);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name_norm);

CREATE TABLE IF NOT EXISTS rdv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  date_debut TEXT NOT NULL,
  date_fin TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'planifie',
  rappel_minutes INTEGER NOT NULL DEFAULT 30,
  notes TEXT NOT NULL DEFAULT '',
  search_norm TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rdv_date ON rdv(date_debut);
CREATE INDEX IF NOT EXISTS idx_rdv_client ON rdv(client_id);

CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'a_faire',
  date_intervention TEXT NOT NULL DEFAULT '',
  search_norm TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_int_client ON interventions(client_id);

CREATE TABLE IF NOT EXISTS intervention_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intervention_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intervention_commentaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  commentaire TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  date_devis TEXT NOT NULL,
  date_validite TEXT NOT NULL DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'brouillon',
  remise_pct REAL NOT NULL DEFAULT 0,
  remise_montant REAL NOT NULL DEFAULT 0,
  tva_pct REAL NOT NULL DEFAULT 20,
  notes TEXT NOT NULL DEFAULT '',
  search_norm TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devis_client ON devis(client_id);

CREATE TABLE IF NOT EXISTS devis_lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devis_id INTEGER NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantite REAL NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0,
  unite TEXT NOT NULL DEFAULT '',
  ordre INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devis_paiements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devis_id INTEGER NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  montant REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'acompte',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT '',
  libelle TEXT NOT NULL,
  montant REAL NOT NULL,
  date TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_date ON finance_transactions(date);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function clientSearchNorm(c) {
  return [
    c.nom, c.prenom, c.telephone, c.email, c.adresse,
    c.code_postal, c.ville, c.departement, c.notes, digits(c.telephone),
  ].map(norm).filter(Boolean).join(' ');
}

function rowToClient(row) {
  if (!row) return null;
  const { search_norm, tel_norm, name_norm, ...rest } = row;
  return rest;
}

function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);

  const api = {};

  api.path = dbPath;
  api.exec = (sql) => db.exec(sql);

  // ---------------- Clients ----------------

  api.clientsList = (query = '', limit = 300) => {
    const tokens = norm(query).split(' ').filter(Boolean);
    let sql = 'SELECT * FROM clients';
    const params = [];
    if (tokens.length) {
      const clauses = tokens.map((t) => '(search_norm LIKE ? OR tel_norm LIKE ?)');
      sql += ' WHERE ' + clauses.join(' AND ');
      for (const t of tokens) {
        params.push(`%${t}%`, `%${t}%`);
      }
    }
    sql += ' ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE LIMIT ?';
    params.push(limit);
    return all(sql, ...params).map(rowToClient);
  };

  api.clientGet = (id) => {
    const client = rowToClient(get('SELECT * FROM clients WHERE id = ?', id));
    if (!client) return null;
    return {
      client,
      rdvs: all(
        'SELECT id, titre, date_debut, date_fin, statut, notes FROM rdv WHERE client_id = ? ORDER BY date_debut DESC',
        id
      ),
      interventions: all(
        'SELECT id, titre, description, statut, date_intervention FROM interventions WHERE client_id = ? ORDER BY created_at DESC',
        id
      ),
      devis: all(
        'SELECT id, numero, date_devis, statut FROM devis WHERE client_id = ? ORDER BY date_devis DESC',
        id
      ),
    };
  };

  api.clientSave = (data) => {
    const nom = String(data.nom || '').trim();
    if (!nom) throw new Error('Le nom du client est obligatoire.');
    const clean = {
      civilite: String(data.civilite || '').trim(),
      nom,
      prenom: String(data.prenom || '').trim(),
      telephone: String(data.telephone || '').trim(),
      email: String(data.email || '').trim(),
      adresse: String(data.adresse || '').trim(),
      code_postal: String(data.code_postal || '').trim(),
      ville: String(data.ville || '').trim(),
      departement: String(data.departement || '').trim(),
      notes: String(data.notes || '').trim(),
    };
    const search = clientSearchNorm(clean);
    const tel = digits(clean.telephone);
    const nameN = `${norm(clean.nom)} ${norm(clean.prenom)}`.trim();
    const ts = nowIso();
    if (data.id) {
      run(
        `UPDATE clients SET civilite=?, nom=?, prenom=?, telephone=?, email=?, adresse=?,
         code_postal=?, ville=?, departement=?, notes=?, search_norm=?, tel_norm=?, name_norm=?, updated_at=?
         WHERE id=?`,
        clean.civilite, clean.nom, clean.prenom, clean.telephone, clean.email, clean.adresse,
        clean.code_postal, clean.ville, clean.departement, clean.notes, search, tel, nameN, ts,
        data.id
      );
      return rowToClient(get('SELECT * FROM clients WHERE id = ?', data.id));
    }
    const res = run(
      `INSERT INTO clients (civilite, nom, prenom, telephone, email, adresse, code_postal, ville,
       departement, notes, search_norm, tel_norm, name_norm, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      clean.civilite, clean.nom, clean.prenom, clean.telephone, clean.email, clean.adresse,
      clean.code_postal, clean.ville, clean.departement, clean.notes, search, tel, nameN, ts, ts
    );
    return rowToClient(get('SELECT * FROM clients WHERE id = ?', Number(res.lastInsertRowid)));
  };

  api.clientDelete = (id) => {
    run('DELETE FROM clients WHERE id = ?', id);
    return true;
  };

  api.clientDuplicates = (data, excludeId = null) => {
    const found = new Map();
    const tel = digits(data.telephone);
    if (tel.length >= 6) {
      const rows = excludeId
        ? all('SELECT id, nom, prenom, telephone, ville FROM clients WHERE tel_norm = ? AND id <> ?', tel, excludeId)
        : all('SELECT id, nom, prenom, telephone, ville FROM clients WHERE tel_norm = ?', tel);
      for (const r of rows) found.set(r.id, { ...r, raison: 'Même numéro de téléphone' });
    }
    const nameN = `${norm(data.nom || '')} ${norm(data.prenom || '')}`.trim();
    if (nameN) {
      const rows = excludeId
        ? all('SELECT id, nom, prenom, telephone, ville FROM clients WHERE name_norm = ? AND id <> ?', nameN, excludeId)
        : all('SELECT id, nom, prenom, telephone, ville FROM clients WHERE name_norm = ?', nameN);
      for (const r of rows) {
        if (!found.has(r.id)) found.set(r.id, { ...r, raison: 'Même nom et prénom' });
      }
    }
    return [...found.values()];
  };

  // ---------------- Recherche globale ----------------

  api.globalSearch = (query, limitPerType = 6) => {
    const tokens = norm(query).split(' ').filter(Boolean);
    if (!tokens.length) return { clients: [], rdvs: [], interventions: [], devis: [] };
    const clauses = tokens.map(() => '(search_norm LIKE ?)').join(' AND ');
    const params = tokens.map((t) => `%${t}%`);

    const clients = all(
      `SELECT id, nom, prenom, telephone, ville, code_postal FROM clients
       WHERE ${clauses} ORDER BY nom COLLATE NOCASE LIMIT ?`, ...params, limitPerType);
    const rdvs = all(
      `SELECT r.id, r.titre, r.date_debut, r.statut, c.nom AS client_nom, c.prenom AS client_prenom
       FROM rdv r LEFT JOIN clients c ON c.id = r.client_id
       WHERE ${clauses.replace(/search_norm/g, 'r.search_norm')} ORDER BY r.date_debut DESC LIMIT ?`,
      ...params, limitPerType);
    const interventions = all(
      `SELECT i.id, i.titre, i.statut, c.nom AS client_nom, c.prenom AS client_prenom
       FROM interventions i LEFT JOIN clients c ON c.id = i.client_id
       WHERE ${clauses.replace(/search_norm/g, 'i.search_norm')} ORDER BY i.created_at DESC LIMIT ?`,
      ...params, limitPerType);
    const devis = all(
      `SELECT d.id, d.numero, d.date_devis, d.statut, c.nom AS client_nom, c.prenom AS client_prenom
       FROM devis d LEFT JOIN clients c ON c.id = d.client_id
       WHERE ${clauses.replace(/search_norm/g, 'd.search_norm')} ORDER BY d.date_devis DESC LIMIT ?`,
      ...params, limitPerType);
    return { clients, rdvs, interventions, devis };
  };

  // ---------------- Statistiques ----------------

  api.stats = () => {
    const today = new Date().toISOString().slice(0, 10);
    const count = (sql, ...params) => Number(get(sql, ...params).n);
    return {
      clients: count('SELECT COUNT(*) AS n FROM clients'),
      rdvToday: count("SELECT COUNT(*) AS n FROM rdv WHERE date_debut LIKE ?", `${today}%`),
      interventionsEnCours: count("SELECT COUNT(*) AS n FROM interventions WHERE statut IN ('a_faire','en_cours')"),
      devisEnCours: count("SELECT COUNT(*) AS n FROM devis WHERE statut IN ('brouillon','envoye')"),
      derniersClients: all(
        'SELECT id, nom, prenom, ville, created_at FROM clients ORDER BY created_at DESC LIMIT 6'
      ),
    };
  };

  // ---------------- Paramètres ----------------

  api.settingGet = (key) => {
    const row = get('SELECT value FROM settings WHERE key = ?', key);
    return row ? row.value : null;
  };

  api.settingSet = (key, value) => {
    run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, String(value)
    );
    return true;
  };

  api.close = () => {
    try { db.close(); } catch { /* déjà fermée */ }
  };

  return api;
}

module.exports = { openDb, norm, digits };
