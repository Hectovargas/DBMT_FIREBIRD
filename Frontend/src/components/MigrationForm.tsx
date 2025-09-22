import React, { useState } from 'react';
import apiService from '../services/apiService';
import './MigrationForm.css';

interface MigrationFormProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName?: string;
}

const MigrationForm: React.FC<MigrationFormProps> = ({ 
  isOpen, 
  onClose, 
  connectionId, 
  connectionName 
}) => {
  const [config, setConfig] = useState({
    host: 'localhost',
    database: '',
    user: 'postgres',
    password: '',
    port: 5432
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await apiService.migrate(connectionId, config);
      
      if (response.success) {
        setResult({ 
          success: true, 
          message: 'Migración completada exitosamente! Revisa tu base de datos PostgreSQL.' 
        });
      } else {
        setResult({ 
          success: false, 
          message: response.message || 'Error en la migración' 
        });
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: error.message || 'Error al conectar con el servidor' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setConfig({
      host: 'localhost',
      database: '',
      user: 'postgres', 
      password: '',
      port: 5432
    });
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="migration-modal">
        <div className="modal-header">
          <h2>Migrar a PostgreSQL</h2>
          <p>Conexión origen: <strong>{connectionName}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="migration-form">
          <div className="form-section">
            <h3>Configuración PostgreSQL de destino:</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="host">Host:</label>
                <input
                  id="host"
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({...config, host: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="port">Puerto:</label>
                <input
                  id="port"
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({...config, port: parseInt(e.target.value)})}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="database">Base de datos:</label>
                <input
                  id="database"
                  type="text"
                  value={config.database}
                  onChange={(e) => setConfig({...config, database: e.target.value})}
                  placeholder="nueva_base_datos"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="user">Usuario:</label>
                <input
                  id="user"
                  type="text"
                  value={config.user}
                  onChange={(e) => setConfig({...config, user: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña:</label>
              <input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => setConfig({...config, password: e.target.value})}
                required
              />
            </div>
          </div>

          {result && (
            <div className={`result-message ${result.success ? 'success' : 'error'}`}>
              {result.message}
            </div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleClose}
              disabled={isLoading}
              className="btn-cancel"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="btn-migrate"
            >
              {isLoading ? 'Migrando...' : 'Iniciar Migración'}
            </button>
          </div>
        </form>

        <div className="migration-info">
          <h4>¿Qué se migrará?</h4>
          <ul>
            <li>Todas las tablas con su estructura</li>
            <li>Todos los datos de las tablas</li>
            <li>Todas las vistas (conversión básica)</li>
            <li>Claves primarias y constraints básicos</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MigrationForm;