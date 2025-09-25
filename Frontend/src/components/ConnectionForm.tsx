import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import type { ConnectionConfig } from '../services/apiService';
import './ConnectionForm.css';

interface ConnectionFormProps {
  onConnectionSuccess: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnectionSuccess, isOpen, onClose }) => {
  const [formData, setFormData] = useState<ConnectionConfig>({
    name: '',
    host: '',
    database: '',
    username: '',
    password: '',
    port: 3050
  });

  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        host: '',
        database: '',
        username: '',
        password: '',
        port: 3050
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (error || success) {
      setError('');
      setSuccess('');
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 3050 : value
    }));
  };

  const handleClose = () => {
      onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTestConnection = async () => {
    if (!formData.host || !formData.database) {
      setError('Host y database son campos requeridos para la prueba');
      return;
    }

    setError('');
    setSuccess('');
    try {
      ;
      const result = await apiService.testConnection(formData);
      if (result.success) {
        setSuccess('Prueba de conexion exitosa');
      } else {
        setError(result.message || 'Error en la prueba de conexion');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión al servidor. Verifica que el backend este ejecutándose.');
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.database) {
      setError('Nombre, host y base de datos son campos requeridos');
      return;
    }
    setError('');
    setSuccess('');
    try {

      const result = await apiService.addConnection(formData);
      if (result.success) {
        setSuccess('Conexion agregada exitosamente');
        onConnectionSuccess();
        setTimeout(() => {
          onClose();
        }, 100);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      { }
      <div className="modal-container">
        { }
        <div className="modal-header">
          <h2>Nueva Conexión de Base de Datos Firebird</h2>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong><span className="error-icon"></span> Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <strong><span className="success-icon"></span> Éxito:</strong> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="connection-form">


          <div className="form-group">
            <label htmlFor="name">Nombre de la Conexión *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Mi Base de Datos Firebird"
            />
          </div>

          <div className="form-group">
            <label htmlFor="host">Host *</label>
            <input
              type="text"
              id="host"
              name="host"
              value={formData.host}
              onChange={handleInputChange}
              required
              placeholder="localhost"
            />
          </div>

          <div className="form-group">
            <label htmlFor="database">Base de Datos *</label>
            <input
              type="text"
              id="database"
              name="database"
              value={formData.database}
              onChange={handleInputChange}
              required
              placeholder="/path/to/database.fdb"
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="SYSDBA"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="masterkey"
            />
          </div>

          <div className="form-group">
            <label htmlFor="port">Puerto</label>
            <input
              type="number"
              id="port"
              name="port"
              value={formData.port}
              onChange={handleInputChange}
              min="1"
              max="65535"
              placeholder="3050"
            />
          </div>

          <div className="form-actions">

            <button
              type="button"
              className={"test-btn"}
              onClick={handleTestConnection}
            >
              Probar Conexion
            </button>

            <button
              type="submit"
              className={"test-btn "}
              disabled={ !formData.name || !formData.host || !formData.database}
            >
              Agregar Conexion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectionForm;