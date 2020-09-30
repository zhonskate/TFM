var zmq = require('zeromq');
var fs = require('fs');
const logger = require('winston');
var invoke = require('./invoke');
var registryIP = 'localhost';
var registryPort = '5000';
const { PerformanceObserver, performance } = require('perf_hooks');


// DB-RELATED DECLARATIONS

const DB_NAME = 'db.json';
const COLLECTION_FUNCTIONS = 'functions';
const COLLECTION_RUNTIMES = 'runtimes';
const COLLECTION_CALLS = 'calls';
const UPLOAD_PATH = 'uploads';
const CALLS_PATH = 'calls';


// Data structures

runtimePool = [];
functionPool = [];

// winston init

logger.level = 'debug';

const myformat = logger.format.combine(
    logger.format.colorize(),
    logger.format.timestamp(),
    logger.format.printf(info => `[WRK] ${info.timestamp} ${info.level}: ${info.message}`)
);

const files = new logger.transports.File({
    format: myformat,
    filename: 'logs/combined.log'
});

const console = new logger.transports.Console({
    format: myformat
});

logger.add(console);
logger.add(files);

// zmq init

var sockReq = zmq.socket('req');
const addressReq = process.env.ZMQ_CONN_ADDRESS || `tcp://127.0.0.1:2000`;
sockReq.connect(addressReq);
logger.info(`Worker Req connected to ${addressReq}`);

var sockSub = zmq.socket('sub');
const addressSub = process.env.ZMQ_CONN_ADDRESS || `tcp://127.0.0.1:2001`;
sockSub.connect(addressSub);
sockSub.subscribe('');
logger.info(`Worker Sub connected to ${addressSub}`);


sockSub.on('message', function(msg){
    logger.info(`MESSAGE PUB ${msg}`);

    stMsg = msg.toString();
    var arrayMsg = stMsg.split('///');

    switch (arrayMsg[0]) {
        case 'RUNTIME':
            processRuntime(arrayMsg);
            break;
        case 'FUNCTION':
            processFunction(arrayMsg);
            break;
    }

});

function processRuntime(arrayMsg) {

    var img = arrayMsg[1]
    logger.verbose(`RECEIVED RUNTIME ${img}`);
    runtimePool.push(img);
    logger.verbose(runtimePool);

}

function processFunction(arrayMsg) {

    var funcName = arrayMsg[1]
    logger.verbose(`RECEIVED FUNCTION ${funcName}`);
    functionPool.push(funcName);
    // FETCH THE FUNCTION DATA
    logger.verbose(functionPool);

}

// TODO: pool for available rts and functions. Auto management of each pool
// TODO: fetch info to the DB and save it.
// TODO: get the calls and invoke as needed. 


sockReq.on('message', function(msg){
    logger.info(`MESSAGE REP ${msg}`);
});

sockReq.send("worker1");