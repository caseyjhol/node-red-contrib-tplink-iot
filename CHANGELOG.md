# Changelog

All notable changes to this project will be documented in this file.

Bear in mind that the [GIT version](https://github.com/caseyjhol/node-red-contrib-tplink) *(source-code)* is always bleeding edge and may *(in most cases, will)* have changes that won't reflect in NPM/[release](https://github.com/caseyjhol/node-red-contrib-tplink/releases) version.

## 0.3.0 (2020-06-03)

### Added

- Hue, Saturation, and Brightness (HSB) support for multicolor bulbs
- HS300 (multi-plug) support

### Changed

- Separated getPowerEvents/getInUseEvents from getPowerUpdateEvents/getInUseUpdateEvents

### Fixed

- Fix emission of online/offline events in smart-plug node

## 0.2.1

### Changed

- Resized SVG icon
- Default name when adding a new device now includes its alias (e.g. Bedroom Light - HS220)

### Fixed

- Included SVG icon in package.json to ensure it is visible

## 0.2.0

### Added

- HS220 brightness support
- Support for turning off LED status light on switches

### Changed

- Payload can now be a JSON object to allow multiple settings to be changed at once
- Updated tplink-smarthome-api to v2
- Removed separate compiled files (moved files into nodes folder)
- Use SVG for icon instead of PNG

### Fixed

- Fix metering messages for plugs

### Breaking

- npm minimum version changed to v3.0.0
- node minimum version changed to v10.0.0

## 0.1.8 - Unreleased

### Added

- This file.
- Get most common info with **`getQuickInfo`** - *such as cloud account, power state, power consumption,  schedule, and many more*.
- **Filetree** hardcoded in `package.json` *(GIT builds clean now)*.
- Google **compiled code** in main `.js` files and formatted code in `.bak.js` files *- harder, better, faster, stronger*.

### Changed

- Fixed some typos *( @rajamalw )*.
- Commands sanity for `brightness` and `temperature` *- won't trigger unless device supports it ( @rajamalw )*.
- Updated documentation.

### Removed

Nothing but bad vibes.