# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.9] - 2025-04-09

### Added

- Added `readString` function to read string values from PLC memory
- Added timing measurements to all read and write operations
  - Each operation now includes a `timeTaken` property (in milliseconds)
  - Batch operations include total time and individual operation times

### Changed

- Standardized result format across all methods (`read`, `readString`, `write`, `writeString`)
  - All methods now return a consistent structure: `{ success, timeTaken, results }`
  - Individual operation details are now organized under the `results` object
  - String operation results include `details` array with individual word operations
- Modified `write` method to return a detailed result object instead of a boolean
  - New return format includes success status, timing information, and individual operation results

## [1.0.2] - 2024-12-09

### Fixed

- Fixed npm package configuration to properly include README.md in the published package
- Added proper files configuration in package.json to include all necessary source and example files

### Added

- Added CHANGELOG.md to track version history
- Included examples directory in the npm package distribution

### Changed

- Updated package.json to explicitly specify included files in the npm package
- Improved npm package structure for better distribution

## [1.0.1] - 2024-12-09

### Fixed

- Initial package configuration fixes

## [1.0.0] - 2024-12-09

### Added

- Initial release
- Basic PLC communication functionality
- Support for reading and writing to Mitsubishi MELSEC PLCs
- Automatic connection management
- Promise-based API
- Comprehensive error handling
- Example code for basic usage
