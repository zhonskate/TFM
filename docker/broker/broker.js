// Libraries
//----------------------------------------------------------------------------------//

var zmq = require('zeromq');
const logger = require('winston');
var invoke = require('./invoke');
var utils = require('./utils');
const fs = require('fs');
var zookeeper = require('node-zookeeper-client');
const {
    env
} = require('process');
const { loggers } = require('winston');


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
    logger.format.printf(info => `[BKR] ${info.timestamp} ${info.level}: ${info.message}`)
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
const addressRou = `tcp://*:${faasConf.zmq.rou}`;
const addressReqBrk = `tcp://*:${faasConf.zmq.reqbrk}`;

var sockReq = zmq.socket('req');
sockReq.connect(addressReq);
logger.info(`Broker Req connected to ${addressReq}`);

var sockSub = zmq.socket('sub');
sockSub.connect(addressSub);
sockSub.subscribe('');
logger.info(`Broker Sub connected to ${addressSub}`);

var sockDB = zmq.socket('req');
sockDB.connect(addressDB);
logger.info(`Broker Sub connected to ${addressDB}`);

var sockRou = zmq.socket('router');
sockRou.identity = 'router';
sockRou.bind(addressRou);
logger.info(`Broker Router bound to ${addressRou}`);

var sockReqBrk = zmq.socket('rep');
sockReqBrk.bind(addressReqBrk);
logger.info(`Broker Rep service bound to ${addressReqBrk}`);


//Zookeeper

var zookeeperAddress = 'faas-zookeeper:2181';

var zooConnected = false;

var zClient = zookeeper.createClient(zookeeperAddress);

zClient.once('connected', function () {
    logger.info(`Connected to zookeeper on address ${zookeeperAddress}`);
    zooConnected = true;
});

const waitForZookeeper = () => {
    return new Promise((resolve, reject) => {
        const maxNumberOfAttempts = 10;
        const intervalTime = 200; //ms

        if (zooConnected) {
            resolve();
            return;
        }

        let currentAttempt = 0
        const interval = setInterval(() => {

            if (zooConnected) {
                clearInterval(interval)
                resolve();
                return;
            } else if (currentAttempt > maxNumberOfAttempts - 1) {
                clearInterval(interval);
                reject(new Error('Maximum number of attempts exceeded'));
                return;
            }
            logger.info(`Connecting to zookeeper... Attempt${currentAttempt}`);
            currentAttempt++;
        }, intervalTime)
    })
}

zClient.connect();


// Data structures

// Workers

var workerStore = {};
var workerCount = 0;
var spotCount = 0;

// Pool of available runtime names
var runtimePool = [];

// Pool of available function names
var functionPool = [];

// Queue of calls
var callQueue = [];

// Pool of available function + runtime info
var functionStore = {};

// Available spots;

var spots = {};
//freeSpots = [];

logger.debug(`SPOTS ${JSON.stringify(spots)}`);

// Other

const CALLS_PATH = 'calls';

const invokePolicy = faasConf.invokePolicy;

const windowTime = 300000;

if (invokePolicy == 'PRELOAD_RUNTIME') {

    logger.verbose('preload runtime data structures');

    var windowArray = [];
    var baseTarget = {};
    var target = {};

    const windowRefresh = 5000;

    setInterval(function () {
        checkWindows();
    }, windowRefresh);


}


// Functions
//----------------------------------------------------------------------------------//

// ZOOKEEPER

async function registerWorker(availableSpots) {

    // register its spots and send back its ID
    var workerId = 'worker' + workerCount;
    workerCount = workerCount + 1;

    logger.verbose(`Registering ${workerId}`)

    workerStore[workerId] = {}
    workerStore[workerId].spots = []

    await createPath('/' + workerId);

    await createPath('/' + workerId + '/free');

    await createPath('/' + workerId + '/busy');

    var currSpotCount = spotCount;

    for (i = spotCount; i < currSpotCount + availableSpots; i++) {
        var pathName = '/' + workerId + '/busy/' + i;
        await createPath(pathName);
        workerStore[workerId].spots.push(spotCount);
        spots['spot' + spotCount] = {};
        spots['spot' + spotCount].multiplier = 0;
        spots['spot' + spotCount].parent = workerId;
        spotCount = spotCount + 1;
    }

    // TODO: return the workerId to identify the worker.
    var sendMsg = {}
    sendMsg.msgType = 'response';
    sendMsg.content = {};
    sendMsg.content.workerId = workerId;
    sendMsg.content.spots = workerStore[workerId].spots;
    sockReqBrk.send(JSON.stringify(sendMsg));

}

async function createPath(path) {

    return new Promise((resolve, reject) => {

        waitForZookeeper();

        zClient.create(path, function (error) {
            if (error) {
                logger.error(`Failed to create node: ${path} due to: ${error}`);
                reject(error);
            } else {
                logger.verbose(`Node: ${path} is successfully created.`);
                resolve();
            }
        });
    });

}

async function getContent(path) {

    return new Promise((resolve, reject) => {

        waitForZookeeper();

        zClient.getData(path, function (event) {
            logger.verbose(`Got event: ${event}.`);
        }, function (error, data, stat) {
            if (error) {
                logger.error(error.stack);
                reject(error.stack);
            }

            logger.verbose(`Got data: ${data}`);
            resolve(data);
        });
    });
}

async function setContent(path, data) {

    await waitForZookeeper();

    let buffer = Buffer.from(JSON.stringify(data));

    zClient.setData(path, buffer, -1, function (error, stat) {
        if (error) {
            logger.error(error.stack);
            return;
        }

        logger.verbose(`Data ${JSON.stringify(data)} is set. ${JSON.stringify(stat)}`);
    });

}

async function setBusySpot(worker, spot){

    return new Promise((resolve, reject) => {

        logger.info(`SETTING BUSY SPOT ${spot}`);
    
        waitForZookeeper();
        
        zClient.transaction().
        check(`/${worker}/free/${spot}`).
        remove(`/${worker}/free/${spot}`, -1).
        create(`/${worker}/busy/${spot}`).
        commit(function (error, results) {
            if (error) {
                logger.error(
                    `Failed to execute the transaction: ${error} , ${results}`);
                reject();
            }

            logger.verbose('Transaction completed.');
            resolve(spot);
        });
    });
}

async function setFreeSpot(worker, spot){

    return new Promise((resolve, reject) => {

        logger.info(`SETTING FREE SPOT ${spot}`);
    
        waitForZookeeper();
        
        zClient.transaction().
        check(`/${worker}/busy/${spot}`).
        remove(`/${worker}/busy/${spot}`, -1).
        create(`/${worker}/free/${spot}`).
        commit(function (error, results) {
            if (error) {
                logger.error(
                    `Failed to execute the transaction: ${error} , ${results}`);
                reject();
            }

            logger.verbose('Transaction completed.');
            resolve(spot);
        });
    });
}

// API-COMMON

function processRuntime(img) {

    logger.verbose(`RECEIVED RUNTIME ${img}`);
    runtimePool.push(img);
    logger.debug(runtimePool);

    if (invokePolicy == 'PRELOAD_RUNTIME') {
        updateBaseTarget();
    }

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

function storeWorker(envelope, worker){
    logger.info(`STORE WORKER ${worker} // ${JSON.stringify(workerStore)}`);
    workerStore[worker].env = envelope;
}


// NO PRELOAD

async function checkSpots() {

    // check if there are calls in the queue

    if (callQueue.length == 0) {
        logger.verbose('Call queue empty');
        return;
    }

    // check if the call has a suitable spot

    var spot = await getFirstFreeSpot();

    logger.info(`SELECTED SPOT ${spot}`);

    if (spot == -1) {
        logger.verbose('No available spots');
    } else {
        if (callQueue.length == 0) {
            logger.verbose('Call queue empty');
            parent = spots['spot' + spot].parent;
            await setFreeSpot(parent, spot).catch((err) => { logger.error(err); });
            return;
        } else {
            selectFirstAvailable(spot);
        }
    }

}

async function selectFirstAvailable(spot) {

    // Select the call 

    callObject = callQueue.shift();

    parent = spots['spot' + spot].parent;

    spots['spot' + spot].callNum = callObject.callNum;
    spots['spot' + spot].status = 'ASSIGNED';

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    //executeNoPreload(callObject, spot);

    //TODO: Send to the worker to execute

    var sendMsg = {}
    sendMsg.msgType = 'executeNoPreload';
    sendMsg.content = callObject;
    sendMsg.spot = spot;
    sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);

}

async function getFirstFreeSpot(){
    logger.debug(`GET FREE FIRST SPOT`);
    for (var i = 0; i < workerCount; i++){
        workerId = 'worker' + i;
        for (var j = 0; j < workerStore[workerId].spots.length; j++){
            var res = await setBusySpot(workerId, workerStore[workerId].spots[j])
                        .catch((err) => { logger.error(err); });
            logger.debug(`RES ${res}`);
            if(res != undefined){
                return res;
            }
        }
    }
    return -1;
}

// function executeNoPreload(callObject, spot) {

//     var timing = new Date().getTime();
//     callObject.insertedCall.timing.queue = timing;

//     logger.verbose(`EXECUTING call ${callObject.callNum} in spot ${spot}`);

//     // invokation depends on policy

//     invoke.preloadNothing(logger, callObject, CALLS_PATH)
//         .then((insertedCall) => {
//             logger.debug(`INSERTED CALL ${JSON.stringify(insertedCall)}`);
//             // Updatear la DB

//             var sendMsg = {}
//             sendMsg.msgType = 'updateCall';
//             sendMsg.content = insertedCall;
//             sockDB.send(JSON.stringify(sendMsg));

//             // avisar a la API

//             sockReq.send(JSON.stringify(sendMsg));

//             if (invokePolicy == "PRELOAD_NOTHING") {
//                 liberateSpot(spot);
//             } else if (invokePolicy == "PRELOAD_RUNTIME") {
//                 backFromExecution(spot);
//             }
//         });

// }

async function liberateSpot(envelope, spot) {

    logger.verbose(`Liberating spot ${spot}`);

    var parent = spots['spot' + spot].parent;

    await setFreeSpot(parent, spot).catch((err) => { logger.error(err); });

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    checkSpots();

}


// PRELOAD RUNTIME

function checkWindows() {

    // TODO:

    logger.verbose('CHECKING WINDOW');

    var now = new Date().getTime();
    var limit = now - windowTime;


    // Updatear la widowArray trimming todo lo que sea mas viejo que now - windowTime.

    while (windowArray.length > 0 && windowArray[0][1] < limit) {
        windowArray.shift();
    }

    // si la array está vacía -> target = baseTarget.

    if (windowArray.length == 0) {
        target = baseTarget;
    } else {

        var counts = {};

        for (var i = 0; i < windowArray.length; i++) {
            var rt = windowArray[i][0];
            counts[rt] = counts[rt] ? counts[rt] + 1 : 1;
        }

        logger.debug(`counts ${JSON.stringify(counts)}`);

        countsSorted = Object.keys(counts).sort(function (a, b) {
            return counts[b] - counts[a]
        })

        //FIXME: todo en general

        logger.debug(`countSorted ${JSON.stringify(countsSorted)}`);
        logger.debug(`SPOTS ${JSON.stringify(spots)}`);
        logger.debug(`CALLQUEUE ${callQueue}`)
        // para la ponderación cuento ticks 1/concLevel y asigno el mayor a un ceil y sucesivamente

        var assigned = 0;
        var mark = 0;

        while (assigned < concLevel) {

            logger.info(`${countsSorted[mark]} ${(counts[countsSorted[mark]] / windowArray.length)} %`);

            var assignations = Math.round((counts[countsSorted[mark]] / windowArray.length) * concLevel);
            assignations = assignations + assigned

            for (var i = assigned; i < assignations && assigned < concLevel; i++) {
                target['spot' + i] = [countsSorted[mark]];
                assigned = assigned + 1;
            }

            mark = mark + 1

        }

        // to be removed

    }

    logger.info(`Target ${JSON.stringify(target)}`);

    // si hay llamadas se ponderan y se actualiza target como sea necesario.

    // iniciar los spots        

}

async function refreshSpots(allRuntimes) {

    while (target['spot0'] == null) {
        setTimeout(function () {
            logger.debug('target not set')
        }, 1000);
    }

    logger.verbose('REFRESHING SPOTS');
    for (i = 0; i < concLevel; i++) {
        if (spots['spot' + i].status == null) {
            backFromExecution(i);
        } else if (spots['spot' + i].status == 'EXECUTING' || spots['spot' + i].status == 'ASSIGNED') {
            continue;
        } else if (spots['spot' + i].status == 'LOADING_RT') {
            continue;
        } else {

            // FIXME: tener en cuenta los runtimes cargados que estén en su sitio.

            if (spots['spot' + i].containerName != null && spots['spot' + i].content != null) {

                logger.verbose('EMPTYING SPOT ' + i);

                await invoke.forceDelete(logger, spots['spot' + i].containerName, spots['spot' + i].content)
                backFromExecution(i);
                if (!allRuntimes) {
                    return;
                }
            }
        }
    }
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
    checkWindows();
    refreshSpots(true);

}

function backFromExecution(spot) {

    logger.verbose(`BACK FROM EXEC ${spot}`)

    // check if there are calls in the queue

    if (callQueue.length > 0) {
        try {
            callObject = callQueue.shift();
            spots['spot' + spot].callNum = callObject.callNum;
            spots['spot' + spot].status = 'ASSIGNED';

            logger.debug(`SPOTS ${JSON.stringify(spots)}`);

            executeNoPreload(callObject, spot);
            refreshSpots(false);
        } catch (err) {
            logger.error(err);
        }
    } else {
        spots['spot' + spot].callNum = '';
        spots['spot' + spot].containerName = `pre${spots['spot' + spot].multiplier * concLevel + spot}`;
        spots['spot' + spot].status = 'LOADING_RT';
        spots['spot' + spot].content = target['spot' + spot];
        spots['spot' + spot].multiplier = spots['spot' + spot].multiplier + 1

        logger.debug(`SPOTS ${JSON.stringify(spots)}`);

        var callObject = {
            "runtime": target['spot' + spot],
            "registryIP": registryIP,
            "registryPort": registryPort,
            "containerName": spots['spot' + spot].containerName
        }

        // FIXME: si se lanza antes de que se caiga el preload anterior es posible que pete. inventar solve

        invoke.preloadRuntime(logger, callObject)
            .then(() => {
                logger.debug('RUNTIME READY IN SPOT ' + spot);

                var timing = new Date().getTime();
                spots['spot' + spot].runtimeTiming = timing;

                if (spots['spot' + spot].buffer != null) {

                    logger.verbose('BUFFER FOUND IN SPOT ' + spot);

                    callObject = spots['spot' + spot].buffer;

                    spots['spot' + spot].callNum = callObject.callNum;
                    spots['spot' + spot].status = 'EXECUTING';

                    spots['spot' + spot].buffer = null;

                    callObject.containerName = spots['spot' + spot].containerName;

                    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

                    execRtPreloaded(callObject, spot);
                } else {
                    spots['spot' + spot].status = 'RUNTIME';
                }
            });

    }

}

function checkRuntimeAvailable(callObject) {


    // Añadir el timing (insertedCall) y el runtime a la array de windowArray.
    windowArray.push([callObject.runtime, callObject.insertedCall.timing.api, callObject.callNum]);

    logger.debug(`WINDOWARRAY ${windowArray}`);

    // Recorrer todos los spots para ver si hay alguno que tenga el runtime del callobject.
    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    var allCorrect = true;

    for (i = 0; i < concLevel; i++) {
        var index = 'spot' + i;
        if (spots[index].content == callObject.runtime) {

            if (spots[index].status == 'LOADING_RT' && spots[index].buffer == null) {

                // Espero al runtime

                spots[index].buffer = callObject;

                return;

            } else if (spots[index].status == 'RUNTIME') {
                // Si es así cambiar el status del spot y ejecutar.

                spots[index].callNum = callObject.callNum;
                spots[index].status = 'EXECUTING';

                callObject.containerName = spots[index].containerName;

                logger.debug(`SPOTS ${JSON.stringify(spots)}`);

                execRtPreloaded(callObject, i);

                return;
            }

        } else {
            allCorrect = false;
        }
    }

    // de no ser así encolar el callObject.

    callQueue.push(callObject);
    logger.debug('PUSHED TO CALLQUEUE');
    logger.debug(JSON.stringify(callQueue));

    if (!allCorrect) {
        refreshSpots(false);
    }

}

function execRtPreloaded(callObject, spot) {

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


// PRELOAD FUNCTION


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
            prepareCall(msg.content);
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

sockRou.on('message', function (envelope, msg) {
    logger.verbose(`MESSAGE ROU ${msg}`);
    logger.verbose(`ENVELOPE ROU ${envelope}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'ready':
            logger.info('received envelope');
            storeWorker(envelope, msg.content);
            break;
        case 'liberateSpot':
            logger.info('liberating spot');
            liberateSpot(envelope, msg.content);
            break;
    }
});

sockReqBrk.on('message', function (msg) {
    logger.verbose(`MESSAGE REQBRK ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'register':
            registerWorker(msg.content);
            break;
    }
});