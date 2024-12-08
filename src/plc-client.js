const ConnectionManager = require('./connection-manager');

class PLCClient {
    constructor(config) {
        this.config = {
            timeout: 30000,
            retryInterval: 2000,
            maxRetries: 3,
            ...config
        };
    }

    async connect() {
        try {
            this.connection = await ConnectionManager.getConnection(
                this.config.host,
                this.config.port,
                this.config
            );
            return true;
        } catch (error) {
            console.error('[PLCClient] Connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await ConnectionManager.closeConnection(this.config.host, this.config.port);
            this.connection = null;
        } catch (error) {
            console.error('[PLCClient] Disconnect error:', error);
            throw error;
        }
    }

    async read(tags, options = {}) {
        const results = {};
        const timeout = options.timeout || this.config.timeout;
        
        try {
            if (!this.connection) {
                await this.connect();
            }

            for (const tag of tags) {
                results[tag.name] = await this._readTag(tag, timeout);
                // Add small delay between reads to prevent overwhelming the PLC
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return results;
        } catch (error) {
            console.error('[PLCClient] Read error:', error);
            throw error;
        }
    }

    async write(tags, options = {}) {
        const results = {};
        const timeout = options.timeout || this.config.timeout;

        try {
            if (!this.connection) {
                await this.connect();
            }

            for (const tag of tags) {
                results[tag.name] = await this._writeTag(tag, timeout);
                // Add small delay between writes to prevent overwhelming the PLC
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return results;
        } catch (error) {
            console.error('[PLCClient] Write error:', error);
            throw error;
        }
    }

    async _readTag(tag, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Read timeout for tag ${tag.name}`));
            }, timeout);

            try {
                this.connection.read(tag.name, (err, data) => {
                    clearTimeout(timer);
                    
                    if (err) {
                        console.error(`[PLCClient] Error reading tag ${tag.name}:`, err);
                        resolve({ 
                            name: tag.name,
                            error: err.message || 'Unknown error',
                            timeStamp: new Date().toISOString()
                        });
                        return;
                    }

                    resolve({
                        name: tag.name,
                        value: data.value,
                        quality: data.quality || 'Good',
                        timeStamp: new Date().toISOString()
                    });
                });
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    async _writeTag(tag, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Write timeout for tag ${tag.name}`));
            }, timeout);

            try {
                this.connection.write(tag.name, tag.value, (err) => {
                    clearTimeout(timer);
                    
                    if (err) {
                        console.error(`[PLCClient] Error writing tag ${tag.name}:`, err);
                        resolve({ 
                            name: tag.name,
                            error: err.message || 'Unknown error',
                            timeStamp: new Date().toISOString()
                        });
                        return;
                    }

                    resolve({
                        name: tag.name,
                        value: tag.value,
                        quality: 'good',
                        timeStamp: new Date().toISOString()
                    });
                });
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }
}

module.exports = PLCClient;
