// Libraries
//----------------------------------------------------------------------------------//

var zmq = require('zeromq');
const logger = require('winston');
var invoke = require('./invoke');
var utils = require('./utils');
const fs = require('fs');
const {
    forceDelete
} = require('./invoke');


// Load faas-conf
//----------------------------------------------------------------------------------//

var content = fs.readFileSync('./faas-conf.json');

const faasConf = JSON.parse(content);


// Declarations
//----------------------------------------------------------------------------------//

// Logger

logger.level = faasConf.logger;

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

logger.info(`conf: ${JSON.stringify(faasConf)}`);


// Zmq

const registryIP = faasConf.registry.ip;
const registryPort = faasConf.registry.port;
const addressReq = `tcp://faas-api:${faasConf.zmq.apiRep}`;
const addressSub = `tcp://faas-api:${faasConf.zmq.apiPub}`;
const addressDB = `tcp://faas-db:${faasConf.zmq.db}`;
const addressRou = `tcp://faas-broker:${faasConf.zmq.rou}`;
const addressReqBrk = `tcp://faas-broker:${faasConf.zmq.reqbrk}`;

var sockReq = zmq.socket('req');
sockReq.connect(addressReq);
logger.info(`Worker Req connected to ${addressReq}`);

var sockSub = zmq.socket('sub');
sockSub.connect(addressSub);
sockSub.subscribe('');
logger.info(`Worker Sub connected to ${addressSub}`);

var sockDB = zmq.socket('req');
sockDB.connect(addressDB);
logger.info(`Worker Sub connected to ${addressDB}`);

var sockRou = zmq.socket('dealer');
//sockRou.identity = 'worker0';
sockRou.connect(addressRou);
logger.info(`Worker Dealer connected to ${addressRou}`);

var sockReqBrk = zmq.socket('req');
sockReqBrk.connect(addressReqBrk);
logger.info(`Worker Req service connected to ${addressReqBrk}`);


// Data structures

// Pool of available runtime names
var runtimePool = [];

// Pool of available function names
var functionPool = [];

// Queue of calls
var callQueue = [];

// Pool of available function + runtime info
var functionStore = {};

// Available spots;

const concLevel = 4;
var spots = {};
freeSpots = [];

logger.debug(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

// Other

const CALLS_PATH = 'calls';

const invokePolicy = faasConf.invokePolicy;

// Functions
//----------------------------------------------------------------------------------//

function processRuntime(img) {

    logger.verbose(`RECEIVED RUNTIME ${img}`);
    runtimePool.push(img);
    logger.debug(runtimePool);

}

function processFunction(funcName) {

    logger.verbose(`RECEIVED FUNCTION ${funcName}`);
    functionPool.push(funcName);
    fetchFunction(funcName);
    logger.debug(functionPool);
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

function prepCall(callObject) {
    // save the parameters to a file

    const callNum = callObject.callNum;
    const runtime = callObject.runtime;
    const funcName = callObject.funcName;
    const params = callObject.insertedCall.params;

    // create the folder
    let commandline = `mkdir -p ${CALLS_PATH}/${callNum}`;
    utils.executeSync(logger, commandline);

    // add an info file
    let fileObject = {
        "runtime": runtime,
        "function": funcName
    };

    commandline = `echo '${JSON.stringify(fileObject)}' > ${CALLS_PATH}/${callNum}/info.json`
    utils.executeSync(logger, commandline);

    // create the params file
    commandline = `echo '${JSON.stringify(params)}' > ${CALLS_PATH}/${callNum}/input.json`
    utils.executeSync(logger, commandline);

}

function executeNoPreload(callObject, spot) {

    prepCall(callObject);

    var timing = new Date().getTime();
    callObject.insertedCall.timing.queue = timing;

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

            if (invokePolicy == "PRELOAD_NOTHING") {
                liberateSpot(spot);
            } else if (invokePolicy == "PRELOAD_RUNTIME") {
                backFromExecution(spot);
            }
        });

}

function liberateSpot(spot) {

    logger.verbose(`Liberating spot ${spot}`);
    var sendMsg = {}
    sendMsg.msgType = 'liberateSpot';
    sendMsg.content = spot;
    sockRou.send(JSON.stringify(sendMsg));

}

function setIntoStart(spot) {

    logger.verbose(`Setting spot ${spot} into exec`);
    var sendMsg = {}
    sendMsg.msgType = 'setIntoStart';
    sendMsg.content = spot;
    sockRou.send(JSON.stringify(sendMsg));

}

function backFromExecution(spot) {

    logger.verbose(`BACK FROM EXEC ${spot}`)

    var sendMsg = {}
    sendMsg.msgType = 'backFromExecution';
    sendMsg.content = spot;
    sockRou.send(JSON.stringify(sendMsg));

}

function execRtPreloaded(callObject, spot) {

    prepCall(callObject);

    invoke.execRuntimePreloaded(logger, callObject, CALLS_PATH)
        .then((insertedCall) => {
            logger.debug(`INSERTED CALL ${JSON.stringify(insertedCall)}`);

            insertedCall.timing.runtime = spots['spot' + spot].runtimeTiming;
            spots['spot' + spot].runtimeTiming = null;

            // Updatear la DB

            var sendMsg = {}
            sendMsg.msgType = 'updateCall';
            sendMsg.content = insertedCall;
            sockDB.send(JSON.stringify(sendMsg));

            // avisar a la API

            sockReq.send(JSON.stringify(sendMsg));

            backFromExecution(spot);
        });
}

function preloadRuntime(callObject, spot) {

    invoke.preloadRuntime(logger, callObject)
        .then(() => {
            logger.debug('RUNTIME READY IN SPOT ' + spot);

            var timing = new Date().getTime();
            spots['spot' + spot].runtimeTiming = timing;


            backFromPreloading(spot, callObject.runtime);
        });
}

function backFromPreloading(spot, runtime) {

    logger.verbose(`BACK FROM PRELOAD ${spot}`)

    var sendMsg = {}
    sendMsg.msgType = 'backFromPreloading';
    sendMsg.content = runtime;
    sendMsg.spot = spot;
    sockRou.send(JSON.stringify(sendMsg));

}

function forceRemove(runtime, spot, containerName) {
    forceDelete(logger, containerName, runtime);
    backFromExecution(spot);

}

function registeredWorker(content) {
    workerId = content.workerId;
    recSpots = content.spots;
    logger.verbose(`setting identity ${workerId}`);
    sockRou.identity = workerId;

    var sendMsg = {}
    sendMsg.msgType = 'ready';
    sendMsg.content = workerId;
    sockRou.send(JSON.stringify(sendMsg));

    for (i = 0; i < recSpots.length; i++) {
        logger.verbose(`recSpot ${recSpots[i]}`);

        spots['spot' + recSpots[i]] = {};
        spots['spot' + recSpots[i]].multiplier = 0;
        freeSpots.push(recSpots[i]);

        if (invokePolicy == 'PRELOAD_NOTHING') {
            liberateSpot(recSpots[i]);
        } else if (invokePolicy == 'PRELOAD_RUNTIME') {
            setIntoStart(recSpots[i]);
        }
    }
}


// Event handling
//----------------------------------------------------------------------------------//

sockReq.on('message', function (msg) {
    logger.verbose(`MESSAGE REP ${msg}`);
});

sockSub.on('message', function (msg) {
    logger.verbose(`MESSAGE PUB ${msg}`);

    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'runtime':
            processRuntime(msg.content);
            break;
        case 'function':
            processFunction(msg.content);
            break;
        case 'call':
            // prepareCall(msg.content);
            break;
    }

});

sockDB.on('message', function (msg) {
    logger.verbose(`MESSAGE DB ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'fetchedFunction':
            storeFunction(msg.content);
            break;
        case 'fetchedCall':
            // prepareCall(msg.content);
            break;
        case 'callInserted':
            break;
    }
    //TODO: get the func info.
});

sockRou.on('message', function (msg) {
    logger.verbose(`MESSAGE ROU ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'executeNoPreload':
            executeNoPreload(msg.content, msg.spot);
            break;
        case 'execRtPreloaded':
            execRtPreloaded(msg.content, msg.spot);
            break;
        case 'preloadRuntime':
            preloadRuntime(msg.content, msg.spot);
            break;
        case 'forceRemoveSpot':
            forceRemove(msg.content, msg.spot, msg.containerName);
            break;
    }
});

sockReqBrk.on('message', function (msg) {
    logger.verbose(`MESSAGE REQBRK ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'response':
            registeredWorker(msg.content);
            break;
    }
});

var regWrk = {}
regWrk.msgType = 'register';
regWrk.content = concLevel;
sockReqBrk.send(JSON.stringify(regWrk));