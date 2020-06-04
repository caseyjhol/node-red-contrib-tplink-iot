const isPlainObject = obj => Object.prototype.toString.call(obj) === '[object Object]';

module.exports = function (RED) {
    'use strict';
    const Client = require('tplink-smarthome-api').Client;
    function SmartPlugNode(config) {
        RED.nodes.createNode(this, config);
        this.config = {
            name: config.name,
            device: config.device,
            interval: parseInt(config.interval),
            eventInterval: parseInt(config.eventInterval)
        };
        const deviceIP = this.config.device;
        const moment = require('moment');
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
            })().catch(() => { return node.handleConnectionError() });
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
            if (isPlainObject(msg.payload)) {
                if (msg.payload.hasOwnProperty('brightness') || msg.payload.hasOwnProperty('led')) {
                    let promises = [];
                    if (msg.payload.hasOwnProperty('state')) {
                        if (typeof msg.payload.state === 'string' ||  msg.payload.state instanceof String) {
                            let msg_test = msg.payload.state.toUpperCase();
                            if (msg_test === 'TRUE' || msg_test === 'ON') msg.payload.state = true;
                            if (msg_test === 'FALSE' || msg_test === 'OFF') msg.payload.state = false;
                        }
                        if (msg.payload.state === 'toggle') {
                            promises.push(node.deviceInstance[0].togglePowerState());
                        } else {
                            promises.push(node.deviceInstance[0].setPowerState(msg.payload.state));
                        };
                    };
                    if (msg.payload.hasOwnProperty('brightness')) {
                        promises.push(node.deviceInstance[0].dimmer.setBrightness(msg.payload.brightness));
                    };
                    if (msg.payload.hasOwnProperty('led')) {
                        promises.push(node.deviceInstance[0].setLedState(msg.payload.led));
                    };
                    Promise.all(promises).catch(error => { return node.handleConnectionError(error, msg) });
                } else if (msg.payload.hasOwnProperty('plug')) {
                    node.sendInput(node.deviceInstance[msg.payload.plug], msg.payload.state);
                } else if (msg.payload.hasOwnProperty('state')) {
                    node.sendInput(node.deviceInstance[0], msg.payload.state);
                }
                if (msg.payload.hasOwnProperty('events')) {
                    msg.payload.events.forEach(event => {
                        node.sendInput(node.deviceInstance[0], event);
                    });
                };
            } else if (typeof msg.payload === 'array' || msg.payload instanceof Array) {
                msg.payload.forEach(event => {
                    node.sendInput(node.deviceInstance[0], event);
                });
            } else {
                node.sendInput(node.deviceInstance[0], msg.payload);
            };
        });
        //PROCESS INPUTS
        node.sendInput = function (device, input) {
            const EVENT_ACTIONS = ['getMeterUpdateEvents', 'getPowerEvents', 'getPowerUpdateEvents', 'getInUseEvents', 'getInUseUpdateEvents', 'getOnlineEvents'];
            let enabledActions = context.get('action');
            if (typeof input === 'string' || input instanceof String) {
                let msg_test = input.toUpperCase();
                if (msg_test === 'TRUE' || msg_test === 'ON') input = true;
                if (msg_test === 'FALSE' || msg_test === 'OFF') input = false;
            };
            switch (input) {
                case true:
                case false:
                    device.setPowerState(input);
                    break;
                case 'toggle':
                    device.togglePowerState();
                    break;
                case 'getInfo':
                    node.deviceInstance[0].getSysInfo()
                        .then(info => {
                            let msg = {};
                            msg.payload = info;
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, msg) });
                    break;
                case 'getCloudInfo':
                    node.deviceInstance[0].cloud.getInfo()
                        .then(info => {
                            let msg = {};
                            msg.payload = info;
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, msg) });
                    break;
                case 'getQuickInfo':
                    device.getInfo()
                        .then(info => {
                            let msg = {};
                            msg.payload = info;
                            msg.payload.plug = node.deviceInstance.findIndex(x => x === device);
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, msg) });
                    break;
                case 'getMeterInfo':
                    device.emeter.getRealtime()
                        .then(info => {
                            let msg = {};
                            msg.payload = info;
                            msg.payload.plug = node.deviceInstance.findIndex(x => x === device);
                            msg.payload.timestamp = moment().format();
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, msg) });
                    break;
                case 'clearEvents':
                    context.set('action', []);
                    break;
                case 'eraseStats':
                    device.emeter.eraseStats({})
                        .then((result) => {
                            let msg = {};
                            msg.payload = result;
                            node.send(msg);
                        }).catch(error => { return node.handleConnectionError(error, msg) });
                    break;
                default:
                    if (EVENT_ACTIONS.indexOf(input) !== -1 && enabledActions.indexOf(input) === -1) enabledActions.push(input);
                    context.set('action', enabledActions);
            };
        };
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
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'power-update':
                    if (node.checkAction('getPowerUpdateEvents')) {
                        let msg = {};
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'in-use':
                case 'not-in-use':
                    if (node.checkAction('getInUseEvents')) {
                        let msg = {};
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'in-use-update':
                    if (node.checkAction('getInUseUpdateEvents')) {
                        let msg = {};
                        msg.payload = {};
                        msg.payload.event = event;
                        msg.payload.state = value;
                        msg.payload.device = node.deviceInstance.findIndex(x => x === device);
                        msg.payload.timestamp = moment().format();
                        node.send(msg);
                    };
                    break;
                case 'emeter-realtime-update':
                    if (node.checkAction('getMeterUpdateEvents')) {
                        let msg = {};
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
                        msg.payload = {};
                        msg.payload.event = event;
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
            client.on('device-new', device => { devices.push(device.host) });
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
