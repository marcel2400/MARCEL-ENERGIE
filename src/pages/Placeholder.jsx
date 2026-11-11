import React from 'react';

export default function Placeholder({ title, text, Icon }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">Module en cours de développement</p>
        </div>
      </div>
      <div className="card coming-soon">
        <div className="coming-icon"><Icon size={34} /></div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
