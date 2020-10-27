var zmq = require('zeromq');
var fs = require('fs');
const logger = require('winston');
var invoke = require('./invoke');
var utils = require('./utils');
var registryIP = 'localhost';
var registryPort = '5000';
const {
    PerformanceObserver,
    performance
} = require('perf_hooks');


// DB-RELATED DECLARATIONS

const DB_NAME = 'db.json';
const COLLECTION_FUNCTIONS = 'functions';
const COLLECTION_RUNTIMES = 'runtimes';
const COLLECTION_CALLS = 'calls';
const UPLOAD_PATH = 'uploads';
const CALLS_PATH = 'calls';


// Data structures

// Pool of available runtime names
var runtimePool = [];

// Pool of available function names
var functionPool = [];

// Queue of calls
var callQueue = [];

// Pool of available function + runtime info
var functionStore = {};

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

// Available spots;

const concLevel = 4;
var spots = {};
freeSpots = [];

for (i = 0; i < concLevel; i++) {
    spots['spot' + i] = {};
    freeSpots.push(i);
}

logger.info(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

// zmq init

var sockReq = zmq.socket('req');
const addressReq = process.env.ZMQ_CONN_ADDRESS || `tcp://faas-api:2000`;
sockReq.connect(addressReq);
logger.info(`Worker Req connected to ${addressReq}`);

var sockSub = zmq.socket('sub');
const addressSub = process.env.ZMQ_CONN_ADDRESS || `tcp://faas-api:2001`;
sockSub.connect(addressSub);
sockSub.subscribe('');
logger.info(`Worker Sub connected to ${addressSub}`);


var sockDB = zmq.socket('req');
const addressDB = process.env.ZMQ_CONN_ADDRESS || `tcp://faas-db:2002`;
sockDB.connect(addressDB);
logger.info(`Worker Sub connected to ${addressDB}`);


sockSub.on('message', function (msg) {
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
        case 'INVOKE':
            processCall(arrayMsg);
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
    fetchFunction(funcName);
    logger.verbose(functionPool);
}

function fetchFunction(funcName) {

    logger.verbose(`FETCHING FUNCTION ${funcName}`);

    var sendMsg = {}
    sendMsg.msgType = 'fetchFunction';
    sendMsg.content = funcName;
    sockDB.send(JSON.stringify(sendMsg));

}

function storeFunction(body) {
    logger.verbose(`STORING FUNCTION ${JSON.stringify(body)}`);
    functionStore[body.function.functionName] = body;
    logger.debug(`STORE ${JSON.stringify(functionStore)}`);

    // FIXME: que esto funcione con docker distribuido (diversos docker daemons) lel

    // var folderName = body.function.runtimeName + '/' + body.function.functionName;
    // logger.debug(`function Name ${folderName}`)

    // // Create a folder to hold the function contents
    // var commandline = `mkdir -p uploads/${body.function.runtimeName}`
    // utils.executeSync(logger, commandline);

    // // extract the file on the newly created folder
    // var commandline = `docker cp faas-api:/ws/uploads/${folderName} /ws/uploads/uploads/${body.function.runtimeName}`
    // utils.executeSync(logger, commandline);

}

function processCall(arrayMsg) {

    callNum = arrayMsg[1]
    logger.verbose(`INVOKE ${callNum}`);

    //FIXME: adecuar

    // get the call info

    var sendMsg = {}
    sendMsg.msgType = 'fetchCall';
    sendMsg.content = callNum;
    sockDB.send(JSON.stringify(sendMsg));

}

function prepareCall(body) {
    logger.verbose(`ENQUEUING CALL ${JSON.stringify(body)}`);

    const callNum = body.callNum;
    const funcName = body.funcName;
    const params = body.params;

    logger.debug(`eC funcName ${funcName}`);

    const functionObj = functionStore[funcName].function;
    const runtimeObj = functionStore[funcName].runtime;

    const containerPath = runtimeObj.path;
    const runtimeRunCmd = runtimeObj.run;
    const runtimeDeps = runtimeObj.dependencies;
    logger.debug(`object runtime ${JSON.stringify(runtimeObj)}`);
    logger.debug(`container path ${containerPath}`);

    // save the parameters to a file

    // create the folder
    let commandline = `mkdir -p ${CALLS_PATH}/${callNum}`;
    utils.executeSync(logger, commandline);

    // add an info file
    let fileObject = {
        "runtime": functionObj.runtimeName,
        "function": funcName
    };

    commandline = `echo '${JSON.stringify(fileObject)}' > ${CALLS_PATH}/${callNum}/info.json`
    utils.executeSync(logger, commandline);

    // create the params file
    commandline = `echo '${JSON.stringify(params)}' > ${CALLS_PATH}/${callNum}/input.json`
    utils.executeSync(logger, commandline);

    // prepare the object

    let callObject = {
        "runtime": functionObj.runtimeName,
        "registry": `${registryIP}:${registryPort}`,
        "callNum": callNum,
        "funcName": funcName,
        "containerPath": containerPath,
        "runtimeDeps": runtimeDeps,
        "runtimeRunCmd": runtimeRunCmd,
        "insertedCall": body
    }

    enqueueCall(callObject);

}

function enqueueCall (callObject){

    callQueue.push(callObject);
    logger.debug('PUSHED TO CALLQUEUE');
    logger.debug(JSON.stringify(callQueue));

    checkSpots();

}

function checkSpots(){

    // check if there are calls in the queue

    if (callQueue.length == 0){
        logger.verbose('Call queue empty');
        return;
    }

    // check if the call has a suitable spot

    // FIXME: Revisar esto. En un futuro va a depender de las preloads, etc. Harán falta mas data structures.

    if (freeSpots.length == 0){
        logger.verbose('No available spots');
        return;
    }

    // Select the call 

    callObject = callQueue.shift();

    // Select and assign the spot

    spot = freeSpots.shift();
    spots['spot' + spot].callNum = callObject.callNum;
    spots['spot' + spot].status = 'ASSIGNED';

    logger.info(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

    executeFunction(callObject, spot);

}

function executeFunction(callObject, spot){

    logger.verbose(`EXECUTING call ${callObject.callNum} in spot ${spot}`);

    // invokation depends on policy

    invoke.preloadNothing(logger, callObject, CALLS_PATH)
    .then((insertedCall) => {
        logger.debug(`INSERTED CALL ${JSON.stringify(insertedCall)}`);
        // Updatear la DB

        var sendMsg = {}
        sendMsg.msgType = 'updateCall';
        sendMsg.content = insertedCall;
        sockDB.send(JSON.stringify(sendMsg));

        // avisar a la API

        sockReq.send(JSON.stringify(sendMsg));

        liberateSpot(spot);

    });

}

function liberateSpot(spot){

    logger.verbose(`Liberating spot ${spot}`);
    freeSpots.push(spot);
    spots['spot' + spot] = {};

    logger.info(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

    checkSpots();
    
}

// TODO: pool for available rts and functions. Auto management of each pool
// TODO: fetch info to the DB and save it.
// TODO: get the calls and invoke as needed. 


sockReq.on('message', function (msg) {
    logger.info(`MESSAGE REP ${msg}`);
});

sockDB.on('message', function (msg) {
    logger.verbose(`MESSAGE DB ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'fetchedFunction':
            storeFunction(msg.content);
            break;
        case 'fetchedCall':
            prepareCall(msg.content);
            break;
        case 'callInserted':
            break;
    }
    //TODO: get the func info.
});

//sockReq.send("worker1");