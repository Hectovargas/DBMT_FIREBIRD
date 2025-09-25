import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

import './DDLViewer.css';
interface DDLViewerProps {
  connectionId: string;
  objectType: 'table' | 'view' | 'function' | 'procedure' | 'trigger' | 'index' | 'sequence';
  objectName: string;
  onClose?: () => void;
}
const DDLViewer: React.FC<DDLViewerProps> = ({
  connectionId,
  objectType,
  objectName,
  onClose
}) => {
  const [ddl, setDdl] = useState<string>('');
  const [error, setError] = useState<string>('');
  useEffect(() => {
    loadDDL();
  }, [connectionId, objectType, objectName]);
  const loadDDL = async () => {
    setError('');
    setDdl('');
    try {
      let result;
      switch (objectType) {
        case 'table':
          result = await apiService.generateTableDDL(connectionId, objectName);
          break;
        case 'view':
          result = await apiService.generateViewDDL(connectionId, objectName);
          break;
        case 'function':
          result = await apiService.generateFunctionDDL(connectionId, objectName);
          break;
        case 'procedure':
          result = await apiService.generateProcedureDDL(connectionId, objectName);
          break;
        case 'trigger':
          result = await apiService.generateTriggerDDL(connectionId, objectName);
          break;
        case 'index':
          result = await apiService.generateIndexDDL(connectionId, objectName);
          break;
        case 'sequence':
          result = await apiService.generateSequenceDDL(connectionId, objectName);
          break;
        default:
          throw new Error('Tipo de objeto no soportado');
      }
      if (result.success && result.sql) {
        setDdl(result.sql);
      } else {
        setError(result.message || 'No se pudo generar el DDL');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el DDL');
    }
  };
  const getObjectTypeLabel = () => {
    const labels = {
      table: 'Tabla',
      view: 'Vista',
      function: 'Función',
      procedure: 'Procedimiento',
      trigger: 'Trigger',
      index: 'Índice',
      sequence: 'Secuencia'
    };
    return labels[objectType] || objectType;
  };
  return (
    <div className="ddl-viewer-overlay">
      <div className="ddl-viewer">
        <div className="ddl-header">
          <div className="header-info">
            <h2>DDL de {getObjectTypeLabel()}</h2>
            <p className="object-name">{objectName}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="ddl-content">
          {error ? (
            <div className="error-container">
              <div className="error-icon">!</div>
              <h3>Error al generar DDL</h3>
              <p>{error}</p>
              <button onClick={loadDDL} className="btn btn-secondary">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="ddl-toolbar">
                <div className="toolbar-left">
                  <span className="ddl-label">DDL Generado:</span>
                </div>
                <div className="toolbar-right">
                </div>
              </div>
              <div className="ddl-code-container">
                <pre className="ddl-code">
                  <code>{ddl}</code>
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default DDLViewer;