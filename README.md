# melsec-connect

A modern Node.js library for communicating with Mitsubishi MELSEC PLCs using MC Protocol. This library provides a robust, promise-based API with automatic connection management and comprehensive error handling.

## Features

- 🚀 Promise-based modern API
- 🔄 Automatic connection management and recovery
- 🛡️ Comprehensive error handling and logging
- 🔌 Support for multiple simultaneous connections
- 📊 Detailed operation results with timestamps and quality indicators
- 🔧 Configurable timeouts and retry mechanisms
- 📚 Support for array reading and writing
- 💬 String reading and writing support

## Installation

```bash
npm install melsec-connect
```

## Quick Start

```javascript
const { PLCClient } = require("melsec-connect");

// Configure your PLC connection
const config = {
  host: "192.168.1.10",
  port: 1281,
  protocol: "TCP",
  ascii: false,
  frame: "3E",
  plcType: "Q",
  timeout: 30000,
  retryInterval: 2000,
  maxRetries: 3,
};

async function example() {
  const plc = new PLCClient(config);

  try {
    // Read from PLC
    const readResult = await plc.read([{ name: "D100", count: 1 }]);
    console.log("Read result:", readResult);

    // Write to PLC
    const writeResult = await plc.write([{ name: "D200", value: 100 }]);
    console.log("Write result:", writeResult);
  } finally {
    await plc.disconnect();
  }
}
```

## API Reference

### PLCClient

Main class for PLC communication.

#### Constructor

```javascript
const plc = new PLCClient(config);
```

#### Methods

- `read(tags)`: Read values from PLC
- `write(tags)`: Write values to PLC
- `writeString(address, text)`: Write string values to consecutive addresses
- `connect()`: Explicitly connect to PLC
- `disconnect()`: Close the connection

### Reading Arrays

You can read multiple consecutive addresses by specifying a `count` in your read tag:

```javascript
// Read 5 consecutive values starting from D100
const result = await plc.read([{ name: "D100", count: 5 }]);
console.log(result.D100.values); // Array of 5 values
```

### Writing Arrays

You can write arrays by passing an array of values:

```javascript
// Write values to 3 consecutive addresses starting from D100
const result = await plc.write([{
    name: "D100",
    value: [100, 200, 300]
}]);
```

### String Operations

Write text to consecutive PLC addresses:

```javascript
// Write string to consecutive addresses starting from D100
await plc.writeString("D100", "Hello PLC!");
```

Each character takes up one byte, and values are packed into words (2 bytes per word).

### Configuration Options

```javascript
{
    host: string,          // PLC IP address
    port: number,          // PLC port number
    protocol: 'TCP',       // Protocol (TCP/UDP)
    ascii: boolean,        // Use ASCII mode
    frame: string,         // Frame type (1E/3E/4E)
    plcType: string,       // PLC type (Q/L/R)
    timeout: number,       // Operation timeout (ms)
    retryInterval: number, // Retry interval (ms)
    maxRetries: number,    // Maximum retry attempts
    logLevel: string      // Log level (DEBUG/INFO/WARN/ERROR)
}
```

## Error Handling

The library provides detailed error information:

```javascript
try {
    await plc.read([...]);
} catch (error) {
    console.error('PLC error:', error.message);
}
```

## Examples

See the `examples` directory for more usage examples:

- Basic read/write operations
- Error handling
- Connection management
- Multiple PLC communication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this in your projects.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

## Credits

This project was inspired by and builds upon the work of:

- [mcprotocol](https://github.com/plcpeople/mcprotocol)
- [node-red-contrib-mcprotocol](https://github.com/Steve-Mcl/node-red-contrib-mcprotocol)
