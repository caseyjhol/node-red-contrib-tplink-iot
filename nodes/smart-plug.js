const isPlainObject = obj => Object.prototype.toString.call(obj) === '[object Object]';

module.exports = function (RED) {
    'use strict';
    const { Client } = require('tplink-smarthome-api');

    function SmartPlugNode(config) {
        const EVENT_ACTIONS = ['getInfoEvents', 'getMeterEvents', 'getPowerEvents', 'getPowerUpdateEvents', 'getInUseEvents', 'getInUseUpdateEvents', 'getOnlineEvents'];
        const COMMANDS = ['getInfo', 'getCloudInfo', 'getQuickInfo', 'getMeterInfo', 'clearEvents', 'eraseStats'];

        RED.nodes.createNode(this, config);
        this.config = {
            name: config.name,
            device: config.device,
            interval: parseInt(config.interval),
            eventInterval: parseInt(config.eventInterval),
            payload: config.payload === undefined ? 'getInfo' : config.payload,
            payloadType: config.payloadType === undefined ? 'info' : config.payloadType,
            debug: config.debug
        };
        const deviceIP = this.config.device;
        const moment = require('moment');
        const numeral = require('numeral');
        const context = this.context();
        context.set('action', []);
        const node = this;
        node.deviceInstance = [];
        node.deviceConnected = false;
        node.client = null;
        if (deviceIP === null || deviceIP === '') {
            node.status({ fill: 'red', shape: 'ring', text: 'Not Configured' });
            return false;
        };
        node.status({ fill: 'grey', shape: 'dot', text: 'Initializing…' });
        //STARTING and PARAMETERS
        node.connectClient = function () {
            const client = new Client;
            node.client = client;
            node.deviceInstance = [];
            (async () => {
                const device = await client.getDevice({ host: deviceIP });
                client.on('device-online', () => { node.sendEvent('device-online', deviceIP, 'online') });
                client.on('device-offline', () => { node.sendEvent('device-offline', deviceIP, 'offline') });
                if (device.children) {
                    if (node.config.debug) node.warn(device.children);
                    node.deviceInstance = await Promise.all(
                        Array.from(device.children.keys(), async childId => {
                            const plug = await client.getDevice({ host: deviceIP, childId });
                            node.monitorEvents(plug);
                            return plug;
                        })
                    );
                } else {
                    node.monitorEvents(device);
                };
                node.deviceInstance.unshift(device);
            })().catch((error) => node.handleConnectionError(error, {}));
            node.deviceConnected = true;
            node.status({ fill: 'green', shape: 'dot', text: 'Connected' });
            client.startDiscovery({ broadcast: deviceIP, discoveryInterval: node.config.interval, offlineTolerance: 1, breakoutChildren: false });
        };
        node.monitorEvents = function (device) {
            device.on('power-on', () => { node.sendEvent('power-on', device, true) });
            device.on('power-off', () => { node.sendEvent('power-off', device, false) });
            device.on('power-update', powerOn => { node.sendEvent('power-update', device, powerOn) });
            device.on('in-use', () => { node.sendEvent('in-use', device, true) });
            device.on('not-in-use', () => { node.sendEvent('not-in-use', device, false) });
            device.on('in-use-update', inUse => { node.sendEvent('in-use-update', device, inUse) });
            device.on('emeter-realtime-update', emeterRealtime => { node.sendEvent('emeter-realtime-update', device, emeterRealtime) });
            device.startPolling(node.config.eventInterval);
        };
        //INPUTS
        node.on('input', function (msg) {
            if (!node.deviceConnected) return node.handleConnectionError('Not Reachable', msg);

            const device = node.deviceInstance[0];
            let send = false;

            if (node.config.debug) node.warn(node.deviceInstance);

            if (isPlainObject(msg.payload)) {
                if (msg.payload.hasOwnProperty('brightness') || msg.payload.hasOwnProperty('led')) {
                    let promises = [];
                    if (msg.payload.hasOwnProperty('state')) {
                        if (typeof msg.payload.state === 'string' ||  msg.payload.state instanceof String) {
                            let msg_test = msg.payload.state.toUpperCase();
                            if (msg_test === 'TRUE' || msg_test === 'ON') msg.payload.state = true;
                            if (msg_test === 'FALSE' || msg_test === 'OFF') msg.payload.state = false;
                        };
                        if (msg.payload.state === 'toggle' || msg.payload.state === 'switch') {
                            promises.push(device.togglePowerState());
                        } else {
                            promises.push(device.setPowerState(msg.payload.state));
                        };
                    };
                    if (msg.payload.hasOwnProperty('brightness')) {
                        promises.push(device.dimmer.setBrightness(msg.payload.brightness));
                    };
                    if (msg.payload.hasOwnProperty('led')) {
                        promises.push(device.setLedState(msg.payload.led));
                    };
                    Promise.all(promises)
                        .then(() => {node.sendPayload(device, msg.payload)})
                        .catch(error => { return node.handleConnectionError(error, msg) });
                } else if (msg.payload.hasOwnProperty('plug')) {
                    send = node.sendInput(node.deviceInstance[msg.payload.plug], msg.payload.state);
                } else if (msg.payload.hasOwnProperty('state')) {
                    send = node.sendInput(device, msg.payload.state);
                }

                if (msg.payload.hasOwnProperty('events')) {
                    if (typeof msg.payload.events === 'array' || msg.payload.events instanceof Array) {
                        msg.payload.events.forEach(event => {
                            node.sendInput(device, event);
                        });
                    } else if (typeof msg.payload === 'string' && msg.payload.events.includes('|')) {
                        msg.payload.split('|').forEach(event => {
                            node.sendInput(device, event);
                        });
                    } else {
                        node.sendInput(device, msg.payload.events);
                    }
                }
            } else if (typeof msg.payload === 'array' || msg.payload instanceof Array) {
                msg.payload.forEach(event => {
                    node.sendInput(device, event);
                });
            } else if (typeof msg.payload === 'string' && msg.payload.includes('|')) {
                msg.payload.split('|').forEach(event => {
                    node.sendInput(device, event);
                });
            } else {
                send = node.sendInput(device, msg.payload);
            }

            if (send) {
                send.then(() => {node.sendPayload(device, msg.payload)});
            }
        });

        node.sendPayload = function (device, input) {
            let msg = {},
                payload = node.config.payload || '';

            if (node.config.payloadType === 'none' || COMMANDS.includes(input) || EVENT_ACTIONS.includes(input)) {
                return;
            }

            switch (node.config.payloadType) {
                case 'json':
                    payload = JSON.parse(payload);
                    break;
                case 'date':
                    payload = Date.now();
                    break;
                case 'bool':
                    payload = payload === 'true';
                    break;
                case 'num':
                    payload = parseInt(payload);
                    break;
                case 'info':
                    node.sendInput(device, payload);
                    return;
            }

            msg.topic = node.config.device;
            msg.payload = payload;

            node.send(msg);
        }

        //PROCESS INPUTS
        node.sendInput = function (device, input) {
            let enabledActions = context.get('action');
            if (typeof input === 'string' || input instanceof String) {
                let msg_test = input.toUpperCase();
                if (msg_test === 'TRUE' || msg_test === 'ON') input = true;
                if (msg_test === 'FALSE' || msg_test === 'OFF') input = false;
            };
            switch (input) {
                case true:
                case false:
                    return device.setPowerState(input);
                    break;
                case 'toggle':
                case 'switch':
                    return device.togglePowerState();
                    break;
                case 'getInfo':
                    return device.getSysInfo()
                        .then(info => {
                            let msg = {};
                            msg.topic = node.config.device;
                            msg.payload = info;
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                            node.setPowerStatus(info);
                        }).catch(error => { return node.handleConnectionError(error, {}) });
                    break;
                case 'getCloudInfo':
                    return device.cloud.getInfo()
                        .then(info => {
                            let msg = {};
                            msg.topic = node.config.device;
                            msg.payload = info;
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, {}) });
                    break;
                case 'getQuickInfo':
                    return device.getInfo()
                        .then(info => {
                            let msg = {};
                            msg.topic = node.config.device;
                            msg.payload = info;
                            msg.payload.plug = node.deviceInstance.findIndex(x => x === device);
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                            node.setPowerStatus(info.sysInfo);
                        }).catch(error => { return node.handleConnectionError(error, {}) });
                    break;
                case 'getMeterInfo':
                    return device.emeter.getRealtime()
                        .then(info => {
                            const current = numeral(info.current_ma/1000.0).format('0.[000]');
                            const voltage = numeral(info.voltage_mv/1000.0).format('0.[0]');
                            const power = numeral(info.power_mw/1000.0).format('0.[00]');
                            if (context.get('state') === 'on') {
                                node.status({fill:'green',shape:'dot',text:`Turned ON [${power}W: ${voltage}V@${current}A]`});
                            } else {
                                node.status({fill:'red',shape:'dot',text:`Turned OFF [${power}W: ${voltage}V@${current}A]`});
                            }

                            let msg = {};
                            msg.topic = node.config.device;
                            msg.payload = info;
                            msg.payload.plug = node.deviceInstance.findIndex(x => x === device);
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, {}) });
                    break;
                case 'clearEvents':
                    context.set('action', []);
                    break;
                case 'eraseStats':
                    device.emeter.eraseStats({})
                        .then((result) => {
                            let msg = {};
                            msg.topic = node.config.device;
                            msg.payload = result;
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, {}) });
                    break;
                default:
                    if (EVENT_ACTIONS.indexOf(input) !== -1 && enabledActions.indexOf(input) === -1) enabledActions.push(input);
                    context.set('action', enabledActions);
            };
        }

        node.setPowerStatus = function (info) {
            if (info.relay_state === 1) {
                context.set('state','on');
                node.status({fill:'green',shape:'dot',text:'Turned ON'});
            } else {
                context.set('state','off');
                node.status({fill:'red',shape:'dot',text:'Turned OFF'});
            }
        }

        //EVENTS
        node.checkAction = function (action) {
            return context.get('action') !== undefined &&
                context.get('action') !== null &&
                context.get('action').includes(action);
        };
        node.sendEvent = function (event, device, value) {
            switch (event) {
                case 'power-on':
                case 'power-off':
                    if (node.checkAction('getPowerEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.powerOn = value;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'power-update':
                    if (node.checkAction('getPowerUpdateEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.powerOn = value;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    //getInfoEvents (placed here to take advantage of polling interval)
                    if (node.checkAction('getInfoEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = device.sysInfo;
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'in-use':
                case 'not-in-use':
                    if (node.checkAction('getInUseEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.inUse = value;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'in-use-update':
                    if (node.checkAction('getInUseUpdateEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.inUse = value;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'emeter-realtime-update':
                    if (node.checkAction('getMeterEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.emeter = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'device-online':
                case 'device-offline':
                    if (node.checkAction('getOnlineEvents')) {
                        let msg = {};
                        msg.topic = node.config.device;
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.online = value;
                        msg.payload.state = value;
                        msg.payload.device = device;
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    if (event === 'device-offline') node.status({ fill: 'red', shape: 'ring', text: 'Offline' });
                    if (event === 'device-online') node.status({ fill: 'green', shape: 'dot', text: 'Online' });
                    break;
            }
        }
        node.handleConnectionError = function (error, msg) {
            if (error) node.error(error, msg);
            node.status({ fill: 'red', shape: 'ring', text: 'Error' });
            node.deviceConnected = false;
            node.stopAll();
            return node.connectClient();
        };
        node.stopAll = function () {
            node.status({ fill: 'red', shape: 'ring', text: 'Disconnected' });
            node.deviceConnected = false;
            node.deviceInstance.forEach(device => {
                device.stopPolling();
                device.closeConnection();
            });
            delete node.deviceInstance;
            node.client.stopDiscovery();
        };
        node.on('close', function () {
            node.stopAll();
        });
        node.connectClient();
    }
    //Make available as node
    RED.nodes.registerType('smart-plug', SmartPlugNode);
    RED.httpAdmin.get('/smarthome/plugs', (req, res) => {
        try {
            const client = new Client();
            let discoveryTimeout = 10000;
            let devices = [];
            client.on('device-new', device => {
                devices.push({
                    host: device.host,
                    alias: device.alias
                });
            });
            client.startDiscovery({ deviceTypes: ['plug'] });
            setTimeout(() => {
                client.stopDiscovery();
                res.end(JSON.stringify(devices));
            }, discoveryTimeout);
        } catch (error) { res.sendStatus(500).send(error.message) };
    });
    RED.httpAdmin.get('/smarthome/plug', (req, res) => {
        if (!req.query.ip) return res.status(500).send('Missing Device IP…');
        const client = new Client();
        client.getDevice({ host: req.query.ip })
            .then(device => {
                res.end(JSON.stringify({
                    model: device.model,
                    alias: device.alias
                }));
            })
            .catch(error => { res.sendStatus(500).send(error.message) });
    });
};
