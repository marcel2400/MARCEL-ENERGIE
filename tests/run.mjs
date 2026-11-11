import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { openDb, norm, digits } = require('../electron/db.js');
const { searchCommunesOffline, deptFromCp } = require('../electron/adresse.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-test-'));
const dbFile = path.join(tmp, 'test.db');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

console.log('— Base de données —');

let db = openDb(dbFile);

test('création d’un client', () => {
  const c = db.clientSave({ nom: 'Dupont', prenom: 'François', telephone: '06 12 34 56 78', email: 'dupont@example.fr', adresse: '14 rue des Lilas', code_postal: '45000', ville: 'Orléans', departement: 'Loiret' });
  assert.equal(c.id, 1);
  assert.equal(c.ville, 'Orléans');
});

test('nom obligatoire', () => {
  assert.throws(() => db.clientSave({ nom: '' }), /obligatoire/);
});

test('recherche insensible aux accents', () => {
  const r = db.clientsList('francois');
  assert.equal(r.length, 1);
  assert.equal(r[0].nom, 'Dupont');
});

test('recherche par téléphone partiel (chiffres uniquement)', () => {
  const r = db.clientsList('3456');
  assert.equal(r.length, 1);
});

test('recherche par ville', () => {
  assert.equal(db.clientsList('orleans').length, 1);
});

test('recherche par code postal', () => {
  assert.equal(db.clientsList('45000').length, 1);
});

test('recherche multi-mots (ET logique)', () => {
  db.clientSave({ nom: 'Martin', prenom: 'Julie', ville: 'Orléans', telephone: '07 98 76 54 32' });
  assert.equal(db.clientsList('orleans martin').length, 1);
  assert.equal(db.clientsList('orleans dupont').length, 1);
  assert.equal(db.clientsList('orleans inconnu').length, 0);
});

test('détection de doublon par téléphone', () => {
  const d = db.clientDuplicates({ nom: 'Autre', telephone: '0612345678' });
  assert.equal(d.length, 1);
  assert.match(d[0].raison, /téléphone/);
});

test('détection de doublon par nom + prénom', () => {
  const d = db.clientDuplicates({ nom: 'dupont', prenom: 'francois' });
  assert.equal(d.length, 1);
  assert.match(d[0].raison, /nom/);
});

test('pas de faux doublon sur soi-même (exclusion par id)', () => {
  const d = db.clientDuplicates({ nom: 'Dupont', prenom: 'François', telephone: '06 12 34 56 78' }, 1);
  assert.equal(d.length, 0);
});

test('modification d’un client conserve la date de création', () => {
  const before = db.clientGet(1).client.created_at;
  db.clientSave({ id: 1, nom: 'Dupont', prenom: 'François', telephone: '06 12 34 56 78', ville: 'Saran' });
  const after = db.clientGet(1).client;
  assert.equal(after.created_at, before);
  assert.equal(after.ville, 'Saran');
});

test('fiche détaillée avec historique', () => {
  const detail = db.clientGet(1);
  assert.ok(detail.client);
  assert.ok(Array.isArray(detail.rdvs));
  assert.ok(Array.isArray(detail.interventions));
  assert.ok(Array.isArray(detail.devis));
});

test('suppression en cascade', () => {
  db.exec("INSERT INTO rdv (client_id, titre, date_debut, date_fin, created_at, updated_at) VALUES (1, 'Test', '2025-01-01 10:00', '2025-01-01 11:00', 'x', 'x')");
  db.clientDelete(1);
  assert.equal(db.clientsList('').length, 1);
  assert.equal(db.exec ? undefined : undefined, undefined);
  const rdvs = db.globalSearch('Test');
  assert.equal(rdvs.rdvs.length, 0);
});

test('recherche globale find le client', () => {
  const r = db.globalSearch('julie');
  assert.equal(r.clients.length, 1);
});

test('statistiques', () => {
  const s = db.stats();
  assert.equal(s.clients, 1);
  assert.equal(typeof s.rdvToday, 'number');
});

test('paramètres clé/valeur', () => {
  db.settingSet('test', 'valeur');
  assert.equal(db.settingGet('test'), 'valeur');
  db.settingSet('test', 'valeur2');
  assert.equal(db.settingGet('test'), 'valeur2');
});

test('persistance après fermeture et réouverture', () => {
  db.close();
  db = openDb(dbFile);
  const r = db.clientsList('julie');
  assert.equal(r.length, 1, 'la donnée doit survivre au redémarrage');
});

console.log('— Adresses (hors ligne) —');

test('recherche par code postal', () => {
  const r = searchCommunesOffline('45000');
  assert.ok(r.some((x) => x.ville === 'Orléans' && x.codePostal === '45000'));
  assert.equal(r[0].departement, '45');
  assert.equal(r[0].departementNom, 'Loiret');
});

test('recherche par nom de ville insensible aux accents', () => {
  const r = searchCommunesOffline('orleans');
  assert.ok(r.some((x) => x.ville === 'Orléans'));
});

test('recherche préfixe partielle', () => {
  const r = searchCommunesOffline('sar');
  assert.ok(r.some((x) => x.ville === 'Saran'));
});

test('département depuis code postal (Corse 2A)', () => {
  assert.equal(deptFromCp('20000').code, '2A');
  assert.equal(deptFromCp('20200').code, '2B');
  assert.equal(deptFromCp('97100').code, '971');
});

test('normalisation utilitaire', () => {
  assert.equal(norm('ÉtÉ'), 'ete');
  assert.equal(digits('06.12-34'), '061234');
});

db.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
