'use strict';

const communesData = require('./data/communes.json');

const DEPT_NAMES = communesData.d;
const COMMUNES = communesData.c.map(([nom, cps, dept]) => ({
  nom,
  cps,
  dept,
  nomNorm: nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase(),
}));

function deptName(code) {
  if (!code) return '';
  return DEPT_NAMES[code] || '';
}

function deptFromCp(cp) {
  const c = String(cp || '');
  if (c.length < 2) return { code: '', nom: '' };
  let code = c.slice(0, 2);
  if (code === '20') {
    code = Number(c) < 20200 ? '2A' : '2B';
  }
  if (c.startsWith('97') || c.startsWith('98')) code = c.slice(0, 3);
  return { code, nom: DEPT_NAMES[code] || '' };
}

function searchCommunesOffline(query, limit = 8) {
  const q = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  const cpMatch = q.replace(/\s/g, '');
  const isCp = /^\d{2,5}$/.test(cpMatch);
  const results = [];

  if (isCp) {
    for (const com of COMMUNES) {
      const cp = com.cps.find((c) => c.startsWith(cpMatch));
      if (cp) {
        results.push({
          type: 'commune',
          label: `${com.nom} (${cp})`,
          adresse: '',
          ville: com.nom,
          codePostal: cp,
          departement: com.dept,
          departementNom: deptName(com.dept),
        });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  const starts = [];
  const contains = [];
  for (const com of COMMUNES) {
    if (com.nomNorm.startsWith(q)) starts.push(com);
    else if (contains.length < 40 && (com.nomNorm.includes(' ' + q) || com.nomNorm.includes('-' + q))) contains.push(com);
  }
  starts.sort((a, b) => a.nomNorm.length - b.nomNorm.length || a.nomNorm.localeCompare(b.nomNorm));
  const picked = starts.concat(contains).slice(0, limit);
  for (const com of picked) {
    const many = com.cps.length > 3;
    const cps = many ? [com.cps[0]] : com.cps.length ? com.cps : [''];
    for (const cp of cps) {
      results.push({
        type: 'commune',
        label: cp ? `${com.nom} (${cp})` : com.nom,
        adresse: '',
        ville: com.nom,
        codePostal: cp,
        departement: com.dept,
        departementNom: deptName(com.dept),
      });
    }
  }
  return results.slice(0, limit);
}

async function searchOnline(query, timeoutMs = 2500) {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=8&autocomplete=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const dept = deptFromCp(p.postcode);
      const deptFromContext = (p.context || '').split(',')[1];
      return {
        type: p.type === 'municipality' ? 'commune' : 'adresse',
        label: p.label || '',
        adresse: p.type === 'municipality' ? '' : p.name || '',
        ville: p.city || '',
        codePostal: p.postcode || '',
        departement: dept.code || '',
        departementNom: (deptFromContext || '').trim() || dept.nom || '',
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function samePlace(a, b) {
  return (
    a &&
    b &&
    a.ville === b.ville &&
    (a.codePostal || '') === (b.codePostal || '')
  );
}

async function searchAddresses(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  let online = [];
  try {
    online = await searchOnline(q);
  } catch {
    online = [];
  }
  const offline = searchCommunesOffline(q);

  const merged = [...online];
  for (const com of offline) {
    if (!merged.some((r) => samePlace(r, com))) merged.push(com);
  }
  return merged.slice(0, 10);
}

module.exports = { searchAddresses, searchCommunesOffline, deptFromCp, deptName };
