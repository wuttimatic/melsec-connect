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
                if (tag.count && tag.count > 1) {
                    // For array reading, we'll read each item individually and combine
                    const values = [];
                    for (let i = 0; i < tag.count; i++) {
                        const addr = `${tag.name.replace(/\d+$/, '')}${parseInt(tag.name.match(/\d+$/)[0]) + i}`;
                        const result = await this._readTag({ name: addr }, timeout);
                        if (result.error) {
                            throw new Error(`Error reading array element ${i}: ${result.error}`);
                        }
                        values.push(result.value);
                    }
                    results[tag.name] = {
                        name: tag.name,
                        values,
                        count: tag.count,
                        quality: 'Good',
                        timeStamp: new Date().toISOString()
                    };
                } else {
                    results[tag.name] = await this._readTag(tag, timeout);
                }
                // Add small delay between reads to prevent overwhelming the PLC
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return results;
        } catch (error) {
            console.error('[PLCClient] Read error:', error);
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

    async write(tags, options = {}) {
        const results = {};
        const timeout = options.timeout || this.config.timeout;

        try {
            if (!this.connection) {
                await this.connect();
            }

            for (const tag of tags) {
                if (Array.isArray(tag.value)) {
                    // Handle array writing
                    const baseAddr = tag.name.replace(/\d+$/, '');
                    const startNum = parseInt(tag.name.match(/\d+$/)[0]);
                    const writeResults = [];

                    for (let i = 0; i < tag.value.length; i++) {
                        const addr = `${baseAddr}${startNum + i}`;
                        const result = await this._writeTag({
                            name: addr,
                            value: tag.value[i]
                        }, timeout);
                        
                        if (result.error) {
                            throw new Error(`Error writing array element ${i} to ${addr}: ${result.error}`);
                        }
                        writeResults.push(result);
                    }

                    results[tag.name] = {
                        name: tag.name,
                        values: tag.value,
                        count: tag.value.length,
                        quality: 'Good',
                        timeStamp: new Date().toISOString(),
                        results: writeResults
                    };
                } else {
                    results[tag.name] = await this._writeTag(tag, timeout);
                }
                // Add small delay between writes to prevent overwhelming the PLC
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return results;
        } catch (error) {
            console.error('[PLCClient] Write error:', error);
            throw error;
        }
    }

    async writeString(address, text, options = {}) {
        if (!address || typeof address !== 'string') {
            throw new Error('Address must be a string');
        }
        if (!text || typeof text !== 'string') {
            throw new Error('Text must be a string');
        }

        const timeout = options.timeout || this.config.timeout;
        
        try {
            if (!this.connection) {
                await this.connect();
            }

            // Extract base address and number
            const baseAddrMatch = address.match(/^([A-Za-z]+)(\d+)$/);
            if (!baseAddrMatch) {
                throw new Error(`Invalid address format: ${address}`);
            }
            const baseAddr = baseAddrMatch[1];
            const startNum = parseInt(baseAddrMatch[2]);

            // Pad the text to even length if necessary
            const paddedText = text.length % 2 === 0 ? text : text + '\0';
            const wordCount = Math.ceil(paddedText.length / 2);
            const writeResults = [];

            // Process two characters at a time
            for (let i = 0; i < wordCount; i++) {
                const char1 = paddedText[i * 2] || '\0';
                const char2 = paddedText[i * 2 + 1] || '\0';
                
                // Pack two characters into one word (high byte = first char, low byte = second char)
                const wordValue = (char1.charCodeAt(0) << 8) | char2.charCodeAt(0);
                
                const addr = `${baseAddr}${startNum + i}`;
                const result = await this._writeTag({
                    name: addr,
                    value: wordValue
                }, timeout);

                if (result.error) {
                    throw new Error(`Error writing string word ${i} to ${addr}: ${result.error}`);
                }
                writeResults.push(result);

                // Add small delay between writes
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return {
                address,
                text: paddedText,
                wordCount,
                quality: 'Good',
                timeStamp: new Date().toISOString(),
                results: writeResults
            };

        } catch (error) {
            console.error('[PLCClient] Write string error:', error);
            throw error;
        }
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
