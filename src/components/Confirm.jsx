import React from 'react';
import Modal from './Modal.jsx';

export default function Confirm({ open, title, message, confirmLabel = 'Supprimer', danger = true, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
