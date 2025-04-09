const EventEmitter = require('events');
const mcprotocol = require('./mcprotocol/mcprotocol.js');

class ConnectionManager extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.connectionStates = new Map();
        this.connectionQueue = new Map();
    }

    // Generate a unique connection ID
    _getConnectionId(host, port) {
        return `mcprotocol:${host}:${port}`;
    }

    // Get or create a connection with proper state tracking
    async getConnection(host, port, options = {}) {
        const connectionId = this._getConnectionId(host, port);

        // Check if there's a pending connection
        if (this.connectionStates.get(connectionId) === 'connecting') {
            console.log(`[ConnectionManager] Connection ${connectionId} is already being established`);
            return await this._waitForConnection(connectionId);
        }

        // Check if there's an active connection
        let connection = this.connections.get(connectionId);
        if (connection && connection.isConnected()) {
            console.log(`[ConnectionManager] Reusing existing connection ${connectionId}`);
            return connection;
        }

        // Create new connection
        return await this._createConnection(connectionId, host, port, options);
    }

    // Wait for a pending connection
    async _waitForConnection(connectionId, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Connection timeout waiting for ${connectionId}`));
            }, timeout);

            const checkConnection = setInterval(() => {
                const connection = this.connections.get(connectionId);
                if (connection && connection.isConnected()) {
                    clearInterval(checkConnection);
                    clearTimeout(timer);
                    resolve(connection);
                }
            }, 100);
        });
    }

    // Create a new connection with proper error handling
    async _createConnection(connectionId, host, port, options) {
        console.log(`[ConnectionManager] Creating new connection ${connectionId}`);

        this.connectionStates.set(connectionId, 'connecting');

        const mcpInstance = new mcprotocol();

        // Configure connection
        const connectionOptions = {
            host,
            port,
            protocol: 'TCP',
            ascii: false,
            frame: '3E',
            plcType: 'Q',
            autoConnect: true,
            preventAutoReconnect: true,
            logLevel: 'WARN',
            ...options
        };

        return new Promise((resolve, reject) => {
            const connectionTimeout = setTimeout(() => {
                this.connectionStates.set(connectionId, 'failed');
                reject(new Error(`Connection timeout for ${connectionId}`));
            }, options.timeout || 30000);

            // Setup connection event handlers
            mcpInstance.on('open', () => {
                clearTimeout(connectionTimeout);
                // Store both the instance and its methods
                const connection = {
                    instance: mcpInstance,
                    read: (addr, callback) => mcpInstance.readItems(addr, callback),
                    write: (addr, value, callback) => mcpInstance.writeItems(addr, value, callback),
                    isConnected: () => mcpInstance.isConnected(),
                    disconnect: () => mcpInstance.dropConnection()
                };
                this.connections.set(connectionId, connection);
                this.connectionStates.set(connectionId, 'connected');
                console.log(`[ConnectionManager] Connection established ${connectionId}`);
                resolve(connection);
            });

            mcpInstance.on('error', (error) => {
                console.error(`[ConnectionManager] Connection error ${connectionId}:`, error);
                this.connectionStates.set(connectionId, 'failed');
                this._cleanup(connectionId);
            });

            mcpInstance.on('close', () => {
                console.log(`[ConnectionManager] Connection closed ${connectionId}`);
                this.connectionStates.set(connectionId, 'closed');
                this._cleanup(connectionId);
            });

            // Initiate connection
            try {
                mcpInstance.setDebugLevel(connectionOptions.logLevel);
                mcpInstance.initiateConnection(connectionOptions);
            } catch (error) {
                clearTimeout(connectionTimeout);
                this.connectionStates.set(connectionId, 'failed');
                reject(error);
            }
        });
    }

    // Properly close a connection
    async closeConnection(host, port) {
        const connectionId = this._getConnectionId(host, port);
        const connection = this.connections.get(connectionId);

        if (connection) {
            return new Promise((resolve) => {
                console.log(`[ConnectionManager] Closing connection ${connectionId}`);

                // Set a timeout for connection closure
                const closeTimeout = setTimeout(() => {
                    this._cleanup(connectionId);
                    resolve();
                }, 5000);

                connection.instance.on('close', () => {
                    clearTimeout(closeTimeout);
                    this._cleanup(connectionId);
                    resolve();
                });

                try {
                    connection.disconnect();
                } catch (error) {
                    console.error(`[ConnectionManager] Error closing connection ${connectionId}:`, error);
                    clearTimeout(closeTimeout);
                    this._cleanup(connectionId);
                    resolve();
                }
            });
        }
    }

    // Clean up connection resources
    _cleanup(connectionId) {
        this.connections.delete(connectionId);
        this.connectionStates.delete(connectionId);
        this.connectionQueue.delete(connectionId);
    }

    // Get connection state
    getConnectionState(host, port) {
        const connectionId = this._getConnectionId(host, port);
        return this.connectionStates.get(connectionId) || 'disconnected';
    }
}

// Create singleton instance
const connectionManager = new ConnectionManager();
module.exports = connectionManager;
