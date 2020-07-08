# node-red-contrib-tplink

TP-Link Smart Home Node-Red Nodes

[![GitHub release](https://img.shields.io/github/release/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/releases) [![NPM Version](https://img.shields.io/npm/v/node-red-contrib-tplink.svg?style=flat-square)](https://www.npmjs.com/package/node-red-contrib-tplink) [![GitHub last commit](https://img.shields.io/github/last-commit/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/commits/master)

[![Node version](https://img.shields.io/node/v/node-red-contrib-tplink.svg?style=flat-square)](http://nodejs.org/download/) [![GitHub repo size in bytes](https://img.shields.io/github/repo-size/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink)

[![Github All Releases](https://img.shields.io/github/downloads/caseyjhol/node-red-contrib-tplink/total.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/releases)

[![npm](https://img.shields.io/npm/l/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/blob/master/LICENSE) [![GitHub contributors](https://img.shields.io/github/contributors/caseyjhol/node-red-contrib-tplink.svg?style=flat-square)](https://github.com/caseyjhol/node-red-contrib-tplink/graphs/contributors) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat-square)](https://github.com/Felixls/node-red-contrib-tplink-smarthome/issues)

This is a [Node-RED](https://nodered.org/) node that allows you to control smart plugs, switches, and bulbs from the TP-Link Kasa Smart ecosystem.

Under the hood, this uses [TP-Link Smart Home API](https://github.com/plasticrake/tplink-smarthome-api).

## Installation

Run the following command in the root directory of your Node-RED install

`$ npm install node-red-contrib-tplink`

or you can use the Palette Manager in Node-RED.

## Parameters

`Name` - Type in the name of the host manually or keep the default device name

`Device IP` - Type in the Device IP address manually or press the button to retrieve all locally available plug devices. To specify a plug in a multi-plug device, append a `/` followed by the plug number (zero-indexed). Use is optional. Alternatively, or additionally, an input message can include `msg.topic` with a device IP (and optional plug number). Examples: `192.168.1.101` or `192.168.1.101/3`

`Connection poll interval` - Interval that is used to poll availability of devices _(>500ms / Recommended 5000-10000ms)_. Set to `0` to disable availability checks (in which case, `OnlineEvents` will not trigger, even if started).

`Event poll interval` - Interval that is used to poll active devices for events _(>500ms / Recommended 1000-3000ms)_. Set to `0` to disable event polling (in which case, all events except OnlineEvents will not trigger, even if started).

`Output payload` - Types are `info`, `none`, `string`, `number`, `boolean`, `JSON`, and `timestamp`. Default type is `info` with a value of `getInfo`. If set to `info`, the selected payload command will be fired after completion, and the payload set accordingly. Output payload is ignored if the node input is a command or an event, in which case see below for more information

`Debug` - If enabled, will output device information to the flow editor debug tab.

## Inputs

Send in a message to control, command, or start/stop events.

- `topic` - Optional. The device IP (and optional plug). Any message without a topic will use the device configured via the parameters. If no topic is included, and no device is configured, the message will be ignored.

- `payload` - Required. Either a **control**, **command**, or **event action**. See below for details of each.

### Controls

Control a device by setting its properties.

> string | Object

-  `true` | `on` - Turn on the device
-  `false` | `off` - Turn off the device
-  `toggle` - Switch the power state of the device.
- Or as an object, all properties optional:
	-  `state: true` | `on` | `false` | `off` - Set device on or off
	-  `brightness: [1-100]` - Set brightness, if supported
	-  `temperature: [2700-6500]` - Set brightness (in kelvin), if supported
	-  `hsb: {hue, saturation, brightness}` - Set the color, if supported
	-  `led: true` | `false` - Turn the LED on or off, if supported

### Commands

> string

- `getInfo` - Fetch the device information.
- `getCloudInfo` - Fetch the device information from the cloud.
- `getQuickInfo` - Fetch most popular proprieties, such as username, device consumption, mode, lighting state, and many more. Supports multi-plug.
- `getMeterInfo` - Fetch the current device consumption. Supports multi-plug.
- `eraseStats` - Clear all the meter statistics. Supports multi-plug.

### Events

> string | array | Object

- `startMeterEvents`/`stopMeterEvents` - Subscribe to meter information events. Event emits on event polling interval.
- `startInfoEvents`/`stopInfoEvents` - Subscribe to information events. Event emits on event polling interval.
- `startPowerEvents`/`stopPowerEvents` - Subscribe to power on/off events. Event emits on device/plug change.
- `startPowerUpdateEvents`/`stopPowerUpdateEvents` - Subscribe to power on/off events. Event emits on event polling interval.
- `startInUseEvents`/`stopInUseEvents` - Subscribe to device usage events. Event emits on device/plug change.
- `startInUseUpdateEvents`/`stopInUseUpdateEvents` - Subscribe to device usage events. Event emits on event polling interval.
- `startOnlineEvents`/`stopOnlineEvents` - Subscribe to online/offline events. Event emits on poll interval.
- `stopAllEvents` - Unsubscribe all events.

_Multiple event actions can be sent at once, either as an array or as a string separated by "|". Alternatively, an array or string can be sent in the `events` property of an object._
Examples:

```js
['startMeterUpdateEvents', 'stopPowerEvents']
```

or

```js
{ events: 'startMeterUpdateEvents|stopPowerEvents' }
```

## For developers

This repo. is _(mainly)_ coded on [Node 10.3.0](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V10.md#10.3.0) with [Node-RED 0.18.7](https://github.com/node-red/node-red/blob/master/CHANGELOG.md) on [Windows 10 Home Build 17134.81](https://support.microsoft.com/ro-ro/help/4100403/windows-10-update-kb4100403).

Runs succesfully in a [Raspberry Pi 3 Model B+](https://www.raspberrypi.org/products/raspberry-pi-3-model-b-plus/) on standard Raspbian Stretch's [Node 0.10.29](https://nodejs.org/en/blog/release/v0.10.29/) and matching Node-RED.

[![https://nodei.co/npm/node-red-contrib-tplink.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/node-red-contrib-tplink.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-red-contrib-tplink)
