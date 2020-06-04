
# node-red-contrib-tplink
TP-Link Smart Home Node-Red Nodes

[![GitHub release](https://img.shields.io/github/release/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/releases) [![NPM Version](https://img.shields.io/npm/v/node-red-contrib-tplink.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-tplink) [![GitHub last commit](https://img.shields.io/github/last-commit/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/commits/master)

[![Node version](https://img.shields.io/node/v/node-red-contrib-tplink.svg?style=flat-square)](http://nodejs.org/download/) [![GitHub repo size in bytes](https://img.shields.io/github/repo-size/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink)

[![Github All Releases](https://img.shields.io/github/downloads/caseyjhol/node-red-contrib-tplink/total.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/releases)

[![npm](https://img.shields.io/npm/l/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/blob/master/LICENSE) [![GitHub contributors](https://img.shields.io/github/contributors/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/graphs/contributors) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat-square)](https://github.com/Felixls/node-red-contrib-tplink-smarthome/issues)

This is a collection of [Node-RED](https://nodered.org/) nodes that allow you control smart plugs and bulbs from the TP-Link smart home ecosystem.

This is a fork of so inspiring [node-red-contrib-tplink-smarthome
](https://github.com/Felixls/node-red-contrib-tplink-smarthome) with added functionality.

Under the hood, each node uses the awesome [TP-Link Smart Home API](https://github.com/plasticrake/tplink-smarthome-api).

# Installation

Run the following command in the root directory of your Node-RED install

`$ npm install node-red-contrib-tplink`

or you can use the Palette Manager in Node-RED.

# Parameters

`Name` - Type in the name of the host manually or keep the default device name

`Device IP` - Type in the Device IP address manually or press the button to retrieve all locally available plug devices

`Poll interval` - Interval that is used to poll availability of devices *(>500ms / Recommended 5000-10000ms)*

`Event poll interval` - Interval that is used to poll active devices for events *(>500ms / Recommended 1000-3000ms)*

# Inputs

> payload: Object | string | boolean | array

## On/Off

```js
{
	"state": true // true is "on", false is "off", "toggle" or "switch" sets the opposite power state
}
```

`true` - Turn on the device.

`false` - Turn off the device.

`toggle` - Toggle opposite power state of the device.

`switch` - Toggle opposite power state of the device.

## Multi-Plug On/Off

```js
{
	"plug": 1 // whole number corresponding to "Plug" number on power strip.  Optional.
	"state": true // true is "on", false is "off", "toggle" or "switch" sets the opposite power state
}
```

## Brightness

```js
{
	"brightness": [value 1-100]
}
```

`brightness:[value 1-100]`

*Example: Send payload as `brightness:25` to set brightness of the bulb to 25%.*

## LED Status Light

```js
{
	"led": true // true is "on", false is "off"
}
```

## Temperature

`temperature:[value 2700-6500]`

*Example: Send payload as `temperature:5000` to set temperature of the bulb to 5000k.*

## Color Support for Multicolor Bulbs
Hue, Saturation, and Brightness (HSB) support for multicolor bulbs. 
```js
{
  "hsb": {
    "hue": 240,
    "saturation": 15,
    "brightness": 100
  }
}
```

## Commands

`getInfo` - Fetch the device information.

`getCloudInfo` - Fetch the device information from the cloud.

`getQuickInfo` - Fetch most popular proprieties, such as username, device consumption, mode, lighting state, and many more.  Supports multi-plug.

`getMeterInfo` - Fetch the current device consumption.  Supports multi-plug.

`clearEvents` - Unsubscribe events.

`eraseStats` - Clear all the meter statistics.  Supports multi-plug.

## Events

`getMeterUpdateEvents` - Subscribe to meter information events.  Event emits on event polling interval.

`getPowerEvents` - Subscribe to power on/off events.  Event emits on device/plug change.

`getPowerUpdateEvents` - Subscribe to power on/off events.  Event emits on event polling interval.

`getInUseEvents` - Subscribe to device usage events.  Event emits on device/plug change.

`getInUseUpdateEvents` - Subscribe to device usage events.  Event emits on event polling interval.

`getOnlineEvents` - Subscribe to online/offline events.  Event emits on poll interval.

*Multiple events can be used as an array via the `events` property or string separated by "|"..*

```js
{
	"events": ["getMeterUpdateEvents", "getPowerEvents"]
}
```
or
```js
"getMeterUpdateEvents|getPowerEvents"
```

# For developers

This repo. is *(mainly)* coded on [Node 10.3.0](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V10.md#10.3.0) with [Node-RED 0.18.7](https://github.com/node-red/node-red/blob/master/CHANGELOG.md) on [Windows 10 Home Build 17134.81](https://support.microsoft.com/ro-ro/help/4100403/windows-10-update-kb4100403).
Runs succesfully in a [Raspberry Pi 3 Model B+](https://www.raspberrypi.org/products/raspberry-pi-3-model-b-plus/) on standard Raspbian Stretch's [Node 0.10.29](https://nodejs.org/en/blog/release/v0.10.29/) and matching Node-RED.

[![https://nodei.co/npm/node-red-contrib-tplink.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/node-red-contrib-tplink.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-red-contrib-tplink)
