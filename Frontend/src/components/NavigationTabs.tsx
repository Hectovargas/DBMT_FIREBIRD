
import React from 'react';
import './NavigationTabs.css';

interface NavigationTabsProps {
  activeView: 'welcome' | 'query' | 'table' | 'object' | 'diagram';
  onViewChange: (view: 'welcome' | 'query' | 'table' | 'object' | 'diagram') => void;
  hasConnection: boolean;
  hasTable: boolean;
  hasObject: boolean;
  hasDiagram: boolean;
}

const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeView,
  onViewChange,
  hasConnection,
  hasTable,
  hasObject,
  hasDiagram
}) => {

  return (

    <div className="navigation-tabs">

      <button
        className={`nav-tab ${activeView === 'welcome' ? 'active' : ''}`}
        onClick={() => onViewChange('welcome')}
      >
        <span className="nav-icon home-icon"></span> Inicio
      </button>

      <button
        className={`nav-tab ${activeView === 'query' ? 'active' : ''}`}
        onClick={() => onViewChange('query')}
        disabled={!hasConnection}
      >
        <span className="nav-icon query-icon"></span> Editor de Consultas
      </button>


      <button
        className={`nav-tab ${activeView === 'table' ? 'active' : ''}`}
        onClick={() => onViewChange('table')}
        disabled={!hasTable}
      >
        <span className="nav-icon table-details-icon"></span> Detalles de Tabla
      </button>

      <button
        className={`nav-tab ${activeView === 'object' ? 'active' : ''}`}
        onClick={() => onViewChange('object')}
        disabled={!hasObject}
      >
        <span className="nav-icon object-icon"></span> DDL de Objeto
      </button>

      <button
        className={`nav-tab ${activeView === 'diagram' ? 'active' : ''}`}
        onClick={() => onViewChange('diagram')}
        disabled={!hasDiagram}
      >
        <span className="nav-icon diagram-icon"></span> Diagrama
      </button>


    </div>
  );
};

export default NavigationTabs;