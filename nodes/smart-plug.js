const isPlainObject = obj => Object.prototype.toString.call(obj) === '[object Object]';

module.exports = function(RED) {
    'use strict';
    const Client = require('tplink-smarthome-api').Client;
    function SmartPlugNode(config) {
        RED.nodes.createNode(this, config);
        this.config = {
            name: config.name,
            device: config.device,
            interval: config.interval,
            eventInterval: config.eventInterval
        };
        const deviceIP = this.config.device;
        const moment = require('moment');
        const numeral = require('numeral');
        const context = this.context();
        const node = this;
        node.deviceInstance = null;
        node.deviceConnected = false;
        if (deviceIP === null||deviceIP === '') {
            node.status({fill:'red',shape:'ring',text:'Not configured'});
            return false;
        }
        node.status({fill:'grey',shape:'dot',text:'Initializing…'});

        //STARTING and PARAMETERS
        node.connectClient = function() {
            const client = new Client();
            client.getDevice({host:deviceIP})
            .then((device) => {
                node.deviceConnected = true;
                node.deviceInstance = device;
                node.status({fill:'yellow',shape:'dot',text:'Connected'});
                node.sendDeviceOnlineEvent(true);
                device.on('power-on', () => {node.sendPowerUpdateEvent(true)});
                device.on('power-off', () => {node.sendPowerUpdateEvent(false)});
                device.on('in-use', () => {node.sendInUseEvent(true)});
                device.on('not-in-use', () => {node.sendInUseEvent(false)});
                device.on('device-online', () => {node.sendDeviceOnlineEvent(true)});
                device.on('device-offline', () => {node.sendDeviceOnlineEvent(false)});
                node.startPolling();
            })
            .catch(() => {return node.handleConnectionError()});
        };
        node.disconnectClient = function() {node.deviceConnected = false};
        node.isClientConnected = function() {return node.deviceConnected === true};
        node.startIsAlivePolling = function() {
            node.pingPolling = setInterval(function() {
                if (node.isClientConnected()) node.deviceInstance.getInfo().catch(() => {return node.handleConnectionError()});
                else return node.connectClient()
            }, parseInt(node.config.interval));
        };
        node.stopIsAlivePolling = function() {
            clearInterval(node.pingPolling);
            node.pingPolling = null;
        };
        node.startPolling = function() {
            node.eventPolling = setInterval(function() {
                if (node.deviceInstance === null) {
                    node.stopPolling();
                    return;
                }
                if (node.isClientConnected()) {
                    if (node.checkAction('getInfoEvents')) node.sendDeviceSysInfo(true)
                    if (node.checkAction('getMeterEvents')) node.sendDeviceMeterInfo(true)
                } else {
                    node.status({fill:'red',shape:'ring',text:'Not reachable'});
                    node.sendDeviceOnlineEvent(false);
                    node.stopPolling();
                    return false;
                }
            }, parseInt(node.config.eventInterval));
        };
        node.stopPolling = function () {
            clearInterval(node.eventPolling);
            node.eventPolling = null;
        };

        //INPUTS
        node.on('input', function(msg) {
            // Process event configuration even before we are connected to client
            let enabledActions = [];
            const EVENT_ACTIONS = ['getMeterEvents','getInfoEvents','getPowerUpdateEvents','getInUseEvents','getOnlineEvents'];
            if (isPlainObject(msg.payload)) {
                if (msg.payload.hasOwnProperty('events')) {
                    msg.payload.events.forEach(action => {
                        if (EVENT_ACTIONS.indexOf(action) !== -1) enabledActions.push(action);
                    });
                    if (enabledActions.length > 0) {
                        context.set('action', enabledActions.join('|'));
                    } else {
                        context.set('action', '');
                    }
                }
            }

            // Process other input only if connected to client
            if (!node.isClientConnected()) return node.handleConnectionError('not reachable');

            if (isPlainObject(msg.payload)) {
                let promises = [];

                if (msg.payload.hasOwnProperty('state')) {
                    if (msg.payload.state === 'toggle') {
                        promises.push(node.deviceInstance.togglePowerState());
                    } else {
                        promises.push(node.deviceInstance.setPowerState(msg.payload.state));
                    }
                }

                if (msg.payload.hasOwnProperty('brightness')) {
                    promises.push(node.deviceInstance.dimmer.setBrightness(msg.payload.brightness));
                }

                if (msg.payload.hasOwnProperty('led')) {
                    promises.push(node.deviceInstance.setLedState(msg.payload.led));
                }

                Promise.all(promises)
                    .then(() => {node.sendDeviceSysInfo()})
                    .catch(error => {return node.handleConnectionError(error)});

            } else {
                // test to see if user send a string "true" or "false" or "on" or "off" and change it to boolean true/false
                if (typeof msg.payload === 'string' || msg.payload instanceof String) {
                    let msg_test = msg.payload.toUpperCase();
                    if (msg_test === 'TRUE' || msg_test === 'ON') msg.payload = true;
                    if (msg_test === 'FALSE' || msg_test === 'OFF') msg.payload = false;
                }

                switch (msg.payload) {
                    case true:
                    case false:
                        node.deviceInstance.setPowerState(msg.payload)
                            .then(() => {node.sendDeviceSysInfo()})
                            .catch(error => {return node.handleConnectionError(error)});
                        break;

                    case 'switch':
                        node.deviceInstance.togglePowerState();
                        break;

                    case 'getInfo':
                        node.sendDeviceSysInfo();
                        break;

                    case 'getCloudInfo':
                        node.sendDeviceCloudInfo();
                        break;

                    case 'getQuickInfo':
                        node.sendDeviceQuickInfo();
                        break;

                    case 'getMeterInfo':
                        node.sendDeviceMeterInfo();
                        break;

                    case 'clearEvents':
                        context.set('action', msg.payload);
                        break;

                    case 'eraseStats':
                        node.sendEraseStatsResult();
                        break;

                    default:
                        const actions = msg.payload.split('|');
                        actions.forEach(action => {
                            if (EVENT_ACTIONS.indexOf(action) !== -1) enabledActions.push(action);
                        });
                        if (enabledActions.length > 0) context.set('action', enabledActions.join('|'));
                        else context.set('action', '');
                }
            }
        });

        //EVENTS
        node.checkAction = function(action) {
            return context.get('action') !== undefined &&
            context.get('action') !== null &&
            context.get('action').includes(action);
        };
        node.sendDeviceSysInfo = function(as_event = false) {
            node.deviceInstance.getSysInfo()
            .then(info => {
                if (info.relay_state === 1) {
                    context.set('state','on');
                    node.status({fill:'green',shape:'dot',text:'Turned ON'});
                } else {
                    context.set('state','off');
                    node.status({fill:'red',shape:'dot',text:'Turned OFF'});
                }
                let msg = {};
                msg.payload = info;
                msg.payload.timestamp = moment().format();
                if (as_event) {
                    msg.payload.eventType = "InfoEvent";
                }
                node.send(msg);
            }).catch(error => {return node.handleConnectionError(error)});
        };
        node.sendDeviceCloudInfo = function() {
            node.deviceInstance.cloud.getInfo()
            .then(info => {
                let msg = {};
                msg.payload = info;
                msg.payload.timestamp = moment().format();
                node.send(msg);
            }).catch(error => {return node.handleConnectionError(error)});
        };
        node.sendDeviceQuickInfo = function() {
            node.deviceInstance.getInfo()
            .then(info => {
                let msg = {};
                msg.payload = info;
                msg.payload.timestamp = moment().format();
                node.send(msg);
            }).catch(error => {return node.handleConnectionError(error)});
        };
        node.sendDeviceMeterInfo = function(as_event = false) {
            node.deviceInstance.emeter.getRealtime()
            .then(info => {
                const current = numeral(info.current_ma/1000.0).format('0.[000]');
                const voltage = numeral(info.voltage_mv/1000.0).format('0.[0]');
                const power = numeral(info.power_mw/1000.0).format('0.[00]');
                if (context.get('state') === 'on') {
                    node.status({fill:'green',shape:'dot',text:`Turned ON [${power}W: ${voltage}V@${current}A]`});
                } else {
                    node.status({fill:'red',shape:'dot',text:`Turned OFF [${power}W: ${voltage}V@${current}A]`});
                }
                const msg = {};
                msg.payload = info;
                msg.payload.timestamp = moment().format();
                if (as_event) {
                    msg.payload.eventType = "MeterEvent";
                }
                node.send(msg);
            }).catch(error => {return node.handleConnectionError(error)});
        };
        node.sendPowerUpdateEvent = function(powerOn) {
            if (node.checkAction('getPowerUpdateEvents')) {
                let msg = {};
                msg.payload = {};
                msg.payload.powerOn = powerOn;
                msg.payload.timestamp = moment().format();
                msg.payload.eventType = "PowerUpdateEvent";
                node.send(msg);
            }
        };
        node.sendInUseEvent = function(inUse) {
            if (node.checkAction('getInUseEvents')) {
                let msg = {};
                msg.payload = {};
                msg.payload.inUse = inUse;
                msg.payload.timestamp = moment().format();
                msg.payload.eventType = "InUseEvent";
                node.send(msg);
            }
        };
        node.sendDeviceOnlineEvent = function(online) {
            if (node.checkAction('getOnlineEvents')) {
                let msg = {};
                msg.payload = {};
                msg.payload.online = online;
                msg.payload.timestamp = moment().format();
                msg.payload.eventType = "OnlineEvent";
                node.send(msg);
            }
        };
        node.sendEraseStatsResult = function() {
            node.deviceInstance.emeter.eraseStats({})
            .then((result) => {
                const msg = {};
                msg.payload = result;
                node.send(msg);
            }).catch(error => {return node.handleConnectionError(error)});
        };
        node.handleConnectionError = function(error) {
            if (error) node.error(error);
            node.status({fill:'red',shape:'ring',text:'Not reachable'});
            node.disconnectClient();
            return false;
        };
        node.on('close', function() {
            node.deviceConnected = false;
            node.stopPolling();
            node.stopIsAlivePolling();
        });
        node.connectClient();
        node.startIsAlivePolling();
    }

    //Make available as node
    RED.nodes.registerType('smart-plug', SmartPlugNode);
    RED.httpAdmin.get('/smarthome/plugs', (req, res) => {
        try {
            const client = new Client();
            let discoveryTimeout = 10000;
            let devices = [];
            client.on('device-new', device => {devices.push(device.host)});
            client.startDiscovery({deviceTypes: ['plug']});
            setTimeout(() => {
              client.stopDiscovery();
              res.end(JSON.stringify(devices));
            }, discoveryTimeout);
        } catch(error) {res.sendStatus(500).send(error.message)}
    });
    RED.httpAdmin.get('/smarthome/plug', (req, res) => {
        if (!req.query.ip) return res.status(500).send('Missing Device IP…');
        const client = new Client();
        client.getDevice({host: req.query.ip})
            .then(device => {
                res.end(JSON.stringify({
                    model: device.model,
                    alias: device.alias
                }))
            })
            .catch(error => {res.sendStatus(500).send(error.message)});
    });
};