import React from 'react';
import './content.css';
import AptosaursDisplay from '../Aptosaurs';

function Aptosaurs() {
  return (
    <div className="content-section">
      <h2>APTOSAURS</h2>
      <div className="content-body">
        <AptosaursDisplay />
      </div>
    </div>
  );
}

export default Aptosaurs;