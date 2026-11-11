export const api = typeof window !== 'undefined' && window.atelier ? window.atelier : null;

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatMoney(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
}

export function clientName(c) {
  return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Client';
}

export function initials(c) {
  const a = (c.prenom || c.nom || '?').trim()[0] || '?';
  const b = (c.nom || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

export function clientAddressLine(c) {
  return [c.code_postal, c.ville].filter(Boolean).join(' ');
}
