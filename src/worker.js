// Libraries
//----------------------------------------------------------------------------------//

var zmq = require('zeromq');
const logger = require('winston');
var invoke = require('./invoke');
var utils = require('./utils');
const fs = require('fs');


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


// Zmq

const registryIP = faasConf.registry.ip;
const registryPort = faasConf.registry.port;
const addressReq = `tcp://faas-api:${faasConf.zmq.apiRep}`;
const addressSub = `tcp://faas-api:${faasConf.zmq.apiPub}`;
const addressDB = `tcp://faas-db:${faasConf.zmq.db}`;

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

for (i = 0; i < concLevel; i++) {
    spots['spot' + i] = {};
    freeSpots.push(i);
}

logger.debug(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

// Other

const CALLS_PATH = 'calls';

const invokePolicy = faasConf.invokePolicy;

if (invokePolicy == 'PRELOAD_RUNTIME') {

    logger.verbose('preload runtime data structures');

    const windowTime = 300000;
    var windowArray = [];
    var baseTarget = {};

    for (i = 0; i < concLevel; i++) {
        baseTarget['spot' + i] = {};
    }

    var target = {};

    for (i = 0; i < concLevel; i++) {
        target['spot' + i] = {};
    }

    const windowRefresh = 2000;

    setInterval(function () {
        checkWindows();
    }, 2000);


}


// Functions
//----------------------------------------------------------------------------------//

function processRuntime(arrayMsg) {

    var img = arrayMsg[1]
    logger.verbose(`RECEIVED RUNTIME ${img}`);
    runtimePool.push(img);
    logger.debug(runtimePool);

    if (invokePolicy == 'PRELOAD_RUNTIME') {
        updateBaseTarget();
    }

}

function processFunction(arrayMsg) {

    var funcName = arrayMsg[1]
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

function processCall(arrayMsg) {

    callNum = arrayMsg[1]
    logger.verbose(`INVOKE ${callNum}`);

    //FIXME: adecuar. quizas tiene sentido que llegue de una desde la API.

    // get the call info

    var sendMsg = {}
    sendMsg.msgType = 'fetchCall';
    sendMsg.content = callNum;
    sockDB.send(JSON.stringify(sendMsg));

}

function prepareCall(body) {

    var timing = new Date().getTime();
    body.timing.worker = timing;

    logger.verbose(`PREPARING CALL ${JSON.stringify(body)}`);

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

    if (invokePolicy == 'PRELOAD_NOTHING') {
        enqueueCall(callObject);
    } else if (invokePolicy == 'PRELOAD_RUNTIME') {
        checkRuntimeAvailable(callObject);
    }

}

function enqueueCall(callObject) {

    callQueue.push(callObject);
    logger.debug('PUSHED TO CALLQUEUE');
    logger.debug(JSON.stringify(callQueue));

    checkSpots();

}

function checkSpots() {

    // check if there are calls in the queue

    if (callQueue.length == 0) {
        logger.verbose('Call queue empty');
        return;
    }

    // check if the call has a suitable spot

    // FIXME: Revisar esto. En un futuro va a depender de las preloads, etc. Harán falta mas data structures.

    if (freeSpots.length == 0) {
        logger.verbose('No available spots');
        return;
    }

    if (invokePolicy == "PRELOAD_NOTHING") {
        selectFirstAvailable();
    }

}

function selectFirstAvailable() {

    // Select the call 

    callObject = callQueue.shift();

    // Select and assign the spot

    spot = freeSpots.shift();
    spots['spot' + spot].callNum = callObject.callNum;
    spots['spot' + spot].status = 'ASSIGNED';

    logger.debug(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

    executeNoPreload(callObject, spot);

}

function executeNoPreload(callObject, spot) {

    var timing = new Date().getTime();
    callObject.insertedCall.timing.execute = timing;

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
    freeSpots.push(spot);
    spots['spot' + spot] = {};

    logger.debug(`SPOTS ${JSON.stringify(spots)} free ${freeSpots}`);

    checkSpots();

}

function checkWindows() {

    // TODO:

    // Updatear la widowArray trimming todo lo que sea mas viejo que now - windowRefresh.

    // si la array está vacía -> target = baseTarget.

    // si hay llamadas se ponderan y se actualiza target como sea necesario.

    return;
}

function updateBaseTarget() {

    if (runtimePool.length > concLevel) {
        return;
    }

    for (var i = 0; i < concLevel; i++) {
        for (var j = 0; j < runtimePool.length && i < concLevel; j++) {
            var i = i + j;
            baseTarget['spot' + i] = runtimePool[j];
        }
    }
    logger.verbose(`baseTarget ${JSON.stringify(baseTarget)}`);

}

function backFromExecution(spot) {

    // check if there are calls in the queue

    if (callQueue.length != 0) {
        callObject = callQueue.shift();
        spots['spot' + spot].callNum = callObject.callNum;
        spots['spot' + spot].status = 'ASSIGNED';

        logger.debug(`SPOTS ${JSON.stringify(spots)}`);

        executeNoPreload(callObject, spot);

        return;
    } else {
        spots['spot' + spot].callNum = '';
        spots['spot' + spot].status = 'RUNTIME';
        spots['spot' + spot].content = target['spot' + spot];

        logger.debug(`SPOTS ${JSON.stringify(spots)}`);

        var callObject = {
            "runtime": target['spot' + spot],
            "registryIP": registryIP,
            "registryPort": registryPort,
            "callNum": `pre${spot}`
        }

        // FIXME: si se lanza antes de que se caiga el preload anterior es posible que pete. inventar solve

        invoke.preloadRuntime(target['spot' + spot]);

    }

}

function checkRuntimeAvailable(callObject) {

    // TODO:

    // Añadir el timing (insertedCall) y el runtime a la array de windowArray.

    // Recorrer todos los spots para ver si hay alguno en plan 'RUNTIME' y tiene el runtime del callobject.

    // Si es así cambiar el status del spot y ejecutar.

    // de no ser así encolar el callObject.

    return;
}

// TODO: pool for available rts and functions. Auto management of each pool
// TODO: fetch info to the DB and save it.
// TODO: get the calls and invoke as needed. 


// Event handling
//----------------------------------------------------------------------------------//

sockReq.on('message', function (msg) {
    logger.verbose(`MESSAGE REP ${msg}`);
});

sockSub.on('message', function (msg) {
    logger.verbose(`MESSAGE PUB ${msg}`);

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