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
            { name: "D3030", count: 20 }
        ]);
        console.log('Read result:');
        console.table(readResult);

        // Write string example
        const recipeName = `(M1) APR010010`;
        console.log('\nWriting string to PLC...');
        console.log('String to write:', recipeName);
        
        const writeResult = await plc.writeString("D3030", recipeName);
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
