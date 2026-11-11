import React, { useEffect, useState } from 'react';
import { Database, Save, Upload, Download, FolderOpen, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Confirm from '../components/Confirm.jsx';
import { api, formatDateTime } from '../lib/format.js';

export default function Parametres() {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setInfo(await api.appInfo());
    setBackups(await api.backupsList());
  };

  useEffect(() => { refresh(); }, []);

  const doBackup = async () => {
    setBusy(true);
    const res = await api.backupsCreate();
    setBusy(false);
    if (res.ok) {
      toast(`Sauvegarde créée : ${res.name}`);
      refresh();
    } else {
      toast(`Échec de la sauvegarde : ${res.error}`, 'error');
    }
  };

  const doExport = async () => {
    const res = await api.backupsExport();
    if (res.ok) toast('Copie exportée avec succès.');
    else if (res.error !== 'Annulé.') toast(res.error, 'error');
  };

  const doImport = async () => {
    const res = await api.backupsImport();
    if (res.ok) toast('Base importée. L’application redémarre…', 'info');
    else if (res.error !== 'Annulé.') toast(res.error, 'error');
  };

  const doRestore = async () => {
    if (!confirmRestore) return;
    setBusy(true);
    const res = await api.backupsRestore(confirmRestore.name);
    setBusy(false);
    setConfirmRestore(null);
    if (res.ok) toast('Restauration en cours, l’application redémarre…', 'info');
    else toast(res.error, 'error');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Paramètres</h1>
          <p className="page-subtitle">Données, sauvegardes et sécurité</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2><Database size={17} /> Emplacement des données</h2>
        </div>
        <div className="kv">
          <div className="kv-row">
            <span className="kv-key">Base de données</span>
            <span className="kv-value mono">{info ? info.dbPath : '…'}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Dossier des sauvegardes</span>
            <span className="kv-value mono">{info ? info.backupDir : '…'}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Version</span>
            <span className="kv-value">{info ? info.version : '…'}</span>
          </div>
        </div>
        {info ? (
          <div className="card-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.openPath(info.backupDir)}>
              <FolderOpen size={15} /> Ouvrir le dossier des sauvegardes
            </button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-head">
          <h2><ShieldCheck size={17} /> Sauvegarde et restauration</h2>
        </div>
        <p className="card-text">
          Une sauvegarde automatique est créée à chaque premier démarrage de la journée (les 30 dernières sont conservées).
          Vous pouvez aussi créer, exporter et restaurer des sauvegardes manuellement.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={doBackup}>
            <Save size={16} /> Créer une sauvegarde
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={doExport}>
            <Download size={16} /> Exporter la base
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={doImport}>
            <Upload size={16} /> Importer une base
          </button>
        </div>

        <h3 className="section-sub">Sauvegardes disponibles</h3>
        {backups.length === 0 ? (
          <p className="empty-inline">Aucune sauvegarde pour le moment.</p>
        ) : (
          <div className="list-rows">
            {backups.map((b) => (
              <div key={b.name} className="list-row">
                <div className="row-title">{b.name}</div>
                <div className="row-sub">{formatDateTime(b.date)} · {Math.round(b.size / 1024)} Ko</div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => setConfirmRestore(b)}
                  >
                    Restaurer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        open={!!confirmRestore}
        title="Restaurer cette sauvegarde ?"
        message={`Les données actuelles seront remplacées par « ${confirmRestore ? confirmRestore.name : ''} ». Une sauvegarde de sécurité sera créée avant la restauration, puis l'application redémarrera.`}
        confirmLabel="Restaurer"
        onConfirm={doRestore}
        onCancel={() => setConfirmRestore(null)}
      />
    </div>
  );
}
