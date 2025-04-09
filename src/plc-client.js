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
                    let totalTimeTaken = 0;
                    for (let i = 0; i < tag.count; i++) {
                        const addr = `${tag.name.replace(/\d+$/, '')}${parseInt(tag.name.match(/\d+$/)[0]) + i}`;
                        const timeUsed = new Date().getTime();
                        const result = await this._readTag({ name: addr }, timeout);
                        if (result.error) {
                            throw new Error(`Error reading array element ${i}: ${result.error}`);
                        }
                        values.push(result.value);
                        totalTimeTaken += new Date().getTime() - timeUsed;
                    }
                    results[tag.name] = {
                        name: tag.name,
                        values,
                        count: tag.count,
                        quality: 'Good',
                        timeStamp: new Date().toISOString(),
                        timeTaken: totalTimeTaken
                    };
                } else {
                    const timeUsed = new Date().getTime();
                    const result = await this._readTag(tag, timeout);
                    const timeTaken = new Date().getTime() - timeUsed;
                    results[tag.name] = {
                        ...result,
                        timeTaken
                    };
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
        const timeout = options.timeout || this.config.timeout;
        const results = {};
        let totalTimeTaken = 0;
        
        try {
            // Always establish a fresh connection for writing
            if (this.connection) {
                await this.disconnect();
            }
            await this.connect();

            for (const tag of tags) {
                const timeUsed = new Date().getTime();
                const result = await this._writeTag(tag, timeout);
                const timeTaken = new Date().getTime() - timeUsed;
                totalTimeTaken += timeTaken;
                
                results[tag.name] = {
                    ...result,
                    timeTaken
                };
                
                // Add small delay between writes to prevent overwhelming the PLC
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Always disconnect after writing
            await this.disconnect();
            
            return {
                success: true,
                timeTaken: totalTimeTaken,
                results: results
            };
        } catch (error) {
            console.error('[PLCClient] Write error:', error);
            // Ensure connection is cleaned up even on error
            try {
                if (this.connection) {
                    await this.disconnect();
                }
            } catch (cleanupError) {
                console.error('[PLCClient] Cleanup error:', cleanupError);
            }
            throw error;
        }
    }

    async readString(address, wordCount, options = {}) {
        if (!address || typeof address !== 'string') {
            throw new Error('Address must be a string');
        }
        if (!wordCount || typeof wordCount !== 'number' || wordCount <= 0) {
            throw new Error('WordCount must be a positive number');
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

            let resultString = '';
            const readResults = [];
            let totalTimeTaken = 0;

            // Read specified number of words
            for (let i = 0; i < wordCount; i++) {
                const addr = `${baseAddr}${startNum + i}`;
                const timeUsed = new Date().getTime();
                const result = await this._readTag({ name: addr }, timeout);
                const timeTaken = new Date().getTime() - timeUsed;
                totalTimeTaken += timeTaken;

                if (result.error) {
                    throw new Error(`Error reading string word ${i} from ${addr}: ${result.error}`);
                }
                readResults.push({...result, timeTaken});

                // Extract characters from the word value
                // High byte = first char, low byte = second char
                const wordValue = result.value;
                const char1 = String.fromCharCode((wordValue >> 8) & 0xFF);
                const char2 = String.fromCharCode(wordValue & 0xFF);
                
                // Add characters to result string, stopping at null terminator
                if (char1 !== '\0') resultString += char1;
                else break;
                
                if (char2 !== '\0') resultString += char2;
                else break;

                // Add small delay between reads
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return {
                address,
                text: resultString,
                wordCount: readResults.length,
                quality: 'Good',
                timeStamp: new Date().toISOString(),
                timeTaken: totalTimeTaken,
                results: readResults
            };

        } catch (error) {
            console.error('[PLCClient] Read string error:', error);
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
            let totalTimeTaken = 0;
            for (let i = 0; i < wordCount; i++) {
                const char1 = paddedText[i * 2] || '\0';
                const char2 = paddedText[i * 2 + 1] || '\0';
                
                // Pack two characters into one word (high byte = first char, low byte = second char)
                const wordValue = (char1.charCodeAt(0) << 8) | char2.charCodeAt(0);
                
                const addr = `${baseAddr}${startNum + i}`;
                const timeUsed = new Date().getTime();
                const result = await this._writeTag({
                    name: addr,
                    value: wordValue
                }, timeout);
                const timeTaken = new Date().getTime() - timeUsed;
                totalTimeTaken += timeTaken;

                if (result.error) {
                    throw new Error(`Error writing string word ${i} to ${addr}: ${result.error}`);
                }
                writeResults.push({...result, timeTaken});

                // Add small delay between writes
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return {
                address,
                text: paddedText,
                wordCount,
                quality: 'Good',
                timeStamp: new Date().toISOString(),
                timeTaken: totalTimeTaken,
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
