const { PLCClient } = require('../src');

// PLC Configuration
const config = {
    host: '192.168.8.106',
    port: 1281,
    protocol: 'TCP',
    ascii: false,
    frame: '3E',
    plcType: 'Q',
    timeout: 30000,
    retryInterval: 2000,
    maxRetries: 3,
    logLevel: 'WARN'
};

async function runExample() {
    const plc = new PLCClient(config);

    try {
        // Read example
        console.log('\nReading from PLC...');
        const readResult = await plc.read([
            { name: "D3022", count: 1 }
        ]);
        console.log('Read result:');
        console.table(readResult);

        // Write example
        console.log('\nWriting to PLC...');
        const writeResult = await plc.write([
            { name: "D3010", value: 100 },
            { name: "D3011", value: 50 },
            { name: "D3012", value: 10 }
        ]);
        console.log('Write result:');
        console.table(writeResult);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await plc.disconnect();
    }
}

// Run the example
console.log('Starting PLC communication example...');
runExample()
    .then(() => console.log('Example completed'))
    .catch(error => console.error('Example failed:', error))
    .finally(() => console.log('Example finished'));
