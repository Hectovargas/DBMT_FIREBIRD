import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  ConnectionLineType,
  BackgroundVariant,
  MarkerType,
  Position,
  Handle,
  NodeResizer
} from 'reactflow';

import '@reactflow/node-resizer/dist/style.css';
import 'reactflow/dist/style.css';
import apiService from '../services/apiService';
import './Diagram.css';


interface D3DiagramProps {
  connectionId: string | null;
  connectionName?: string;
}

interface TableNodeProps {
  data: {
    tableName: string;
    columns: ColumnData[];
    isSelected: boolean;
  };
  selected: boolean;
}

interface ColumnData {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
}

interface TableData {
  name: string;
  columns: ColumnData[];
}

interface Relationship {
  from: string;
  to: string;
  constraint?: string;
}

const getFirebirdDataType = (dataType: string | number, precision?: number, scale?: number): string => {
  const typeNum = typeof dataType === 'string' ? parseInt(dataType) : dataType;

  switch (typeNum) {
    case 7: return scale && scale > 0 ? `NUMERIC(${precision},${scale})` : 'SMALLINT';
    case 8: return scale && scale > 0 ? `NUMERIC(${precision},${scale})` : 'INTEGER';
    case 9: return 'QUAD';
    case 10: return 'FLOAT';
    case 11: return 'DOUBLE PRECISION';
    case 12: return 'DATE';
    case 13: return 'TIME';
    case 14: return `CHAR(${precision || ''})`;
    case 16: return scale && scale > 0 ? `NUMERIC(${precision},${scale})` : 'BIGINT';
    case 27: return 'DOUBLE PRECISION';
    case 35: return 'TIMESTAMP';
    case 37: return `VARCHAR(${precision || ''})`;
    case 261: return 'BLOB';
    case 40: return 'CSTRING';
    case 45: return 'BLOB_ID';
    default: return `TYPE_${typeNum}`;
  }
};

const TableNode = ({ data, selected }: TableNodeProps) => {
  const { tableName, columns } = data;

  return (
    <div className={`rf-table-node ${selected ? 'selected' : ''}`}>
      <NodeResizer
        color="#3b82f6"
        isVisible={selected}
        minWidth={200}
        minHeight={100}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="rf-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="rf-handle"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="rf-handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="rf-handle"
      />
      

      <div className="rf-table-header">
        <div className="rf-table-icon"></div>
        <div className="rf-table-title">{tableName}</div>
      </div>
      

      <div className="rf-table-separator"></div>
      

      <div className="rf-table-columns">
        {columns.map((column, index) => (
          <div key={index} className={`rf-table-column ${column.isPrimaryKey ? 'primary-key' : ''}`}>
            <div className="rf-column-icons">
              {column.isPrimaryKey && (
                <span className="rf-icon rf-pk-icon" title="Primary Key">PK</span>
              )}
              {column.isForeignKey && (
                <span className="rf-icon rf-fk-icon" title="Foreign Key">FK</span>
              )}
              {!column.isNullable && !column.isPrimaryKey && (
                <span className="rf-icon rf-nn-icon" title="Not Null">NN</span>
              )}
            </div>
            <div className="rf-column-info">
              <div className="rf-column-name">{column.name}</div>
              <div className="rf-column-type">{column.dataType}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

const D3Diagram = ({ connectionId, connectionName }: D3DiagramProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const generateLayout = (tableData: TableData[], relationships: Relationship[]) => {
    const nodeSpacing = 600;
    const verticalSpacing = 600;
    const cols = Math.ceil(Math.sqrt(tableData.length));
    
    const newNodes: Node[] = tableData.map((table, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const estimatedHeight = Math.max(150, 80 + (table.columns.length * 30));
      
      return {
        id: table.name,
        type: 'tableNode',
        position: {
          x: col * nodeSpacing + (row % 2) * 100,
          y: row * verticalSpacing,
        },
        data: {
          tableName: table.name,
          columns: table.columns,
          isSelected: false,
        },
        dragHandle: '.rf-table-header',
        style: {
          width: 280,
          height: estimatedHeight,
        },
      };
    });

    const newEdges: Edge[] = relationships.map((rel, index) => ({
      id: `edge-${index}`,
      source: rel.from,
      target: rel.to,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'smoothstep',
      animated: false,
      style: { 
        stroke: '#3b82f6', 
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#3b82f6',
      },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };


  const fetchDiagramData = async () => {
    if (!connectionId) {
      return;
    }

    setLoading(true);

    try {
      const tablesResult = await apiService.getTables(connectionId);
      if (!tablesResult.success) {
        throw new Error(tablesResult.message || 'Error al obtener tablas');
      }

      const tableData: TableData[] = [];
      const relationships: Relationship[] = [];

      for (const table of tablesResult.data) {
        const tableName = table.TABLE_NAME.trim();
        const columnsResult = await apiService.getTableColumns(connectionId, tableName);

        if (columnsResult.success && columnsResult.data) {
          const columns: ColumnData[] = columnsResult.data.map((col: any) => ({
            name: col.name,
            dataType: getFirebirdDataType(col.dataType, col.precision, col.scale),
            isPrimaryKey: col.isPrimaryKey === 1,
            isForeignKey: col.isForeignKey === 1,
            isNullable: col.isNullable === 1
          }));

          tableData.push({ name: tableName, columns });
        }
      }


      const fkResult = await apiService.getAllForeignKeys(connectionId);

      if (fkResult.success && fkResult.data) {

        fkResult.data.forEach((fk: any) => {

          if (fk.TABLE_NAME && fk.REFERENCED_TABLE_NAME) {

            relationships.push({
              from: fk.TABLE_NAME.trim(),
              to: fk.REFERENCED_TABLE_NAME.trim(),
              constraint: fk.CONSTRAINT_NAME
            });

          }
        });
      }

      generateLayout(tableData, relationships);
    } catch (err: any) {

    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((els) => addEdge(params, els)),
    [setEdges]
  );

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  useEffect(() => {
    if (connectionId) {
      fetchDiagramData();
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [connectionId]);

  if (!connectionId) {
    return (
      <div className={`rf-diagram-container ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="rf-diagram-header">
          <div className="rf-header-info">
            <h2>Diagrama Relacional</h2>
          </div>
        </div>
        <div className="rf-diagram-placeholder">
          <div className="rf-placeholder-content">
            <div className="rf-placeholder-icon"></div>
            <h3>Selecciona una conexióon</h3>
            <p>Por favor, selecciona una conexion a base de datos para generar el diagrama.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`rf-diagram-container ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="rf-diagram-header">
          <div className="rf-header-info">
            <h2>cargando</h2>
          </div>
        </div>
        <div className="rf-diagram-loading">
          <div className="rf-loading-content">
            <div className="rf-loading-spinner"></div>
            <h3>Generando diagrama ER...</h3>
            <p>Obteniendo estructura de la base de datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rf-diagram-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="rf-diagram-header">
        <div className="rf-header-info">
          <h2>Diagrama ER - {connectionName || 'Base de datos'}</h2>
        </div>
        <div className="rf-diagram-actions">
          <button
            className="rf-btn rf-btn-primary"
            onClick={fetchDiagramData}
            disabled={loading}
          >
            {loading ? 'Generando...' : 'Actualizar'}
          </button>
          <button
            className="rf-btn rf-btn-secondary"
            onClick={toggleFullscreen}
            disabled={nodes.length === 0}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? 'Ventana' : 'Pantalla completa'}
          </button>
        </div>
      </div>

      <div className="rf-flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          maxZoom={1.5}
          minZoom={0.2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Control"
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={25} 
            size={1.5} 
            color="#000000ff"
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export default D3Diagram;