const DatabaseManager = require('./databaseManager_main');
const MigrationManager = require('./MigrationManager');
const OperationsManager = require('./operationsManager');
const DDLManager = require('./ddlManager');
const MetadataManager = require('./metadataManager');

module.exports = new DatabaseManager();