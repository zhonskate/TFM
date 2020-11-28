// Libraries
//----------------------------------------------------------------------------------//

var zmq = require('zeromq');
const logger = require('winston');
const fs = require('fs');
var zookeeper = require('node-zookeeper-client');


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
const addressReq = `tcp://${faasConf.zmq.apiRep.ip}:${faasConf.zmq.apiRep.port}`;
const addressSub = `tcp://${faasConf.zmq.apiRep.ip}:${faasConf.zmq.apiPub.port}`;
const addressDB = `tcp://${faasConf.zmq.apiRep.ip}:${faasConf.zmq.db.port}`;
const addressRou = `tcp://*:${faasConf.zmq.rou.port}`;
const addressReqBrk = `tcp://*:${faasConf.zmq.reqbrk.port}`;

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

var zookeeperAddress = 'localhost:2181';

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

const invokePolicy = faasConf.invokePolicy;

const windowTime = 300000;

if (invokePolicy == 'PRELOAD_RUNTIME' || invokePolicy == 'PRELOAD_FUNCTION') {

    logger.debug('preload data structures');

    var windowArray = [];
    var baseTarget = {};
    var target = {};

    const windowRefresh = 5000;

    setInterval(function () {
        checkWindows();
    }, windowRefresh);
}

var queueStucked = {};


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
                if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
                    logger.verbose(`Path ${path} is already executing`);
                    resolve(-1);
                } else {
                    logger.error(`Failed to create node: ${path} due to: ${error}`);
                    reject(error);
                }
            } else {
                logger.debug(`Node: ${path} is successfully created.`);
                resolve(1);
            }
        });
    });

}

async function getContent(path) {

    // deprecated

    return new Promise((resolve, reject) => {

        waitForZookeeper();

        zClient.getData(path, function (event) {
            logger.debug(`Got event: ${event}.`);
        }, function (error, data, stat) {
            if (error) {
                logger.error(error.stack);
                reject(error.stack);
            }

            logger.debug(`Got data: ${data}`);
            resolve(data);
        });
    });
}

async function setContent(path, data) {

    // Deprecated

    await waitForZookeeper();

    let buffer = Buffer.from(JSON.stringify(data));

    zClient.setData(path, buffer, -1, function (error, stat) {
        if (error) {
            logger.error(error.stack);
            return;
        }

        logger.debug(`Data ${JSON.stringify(data)} is set. ${JSON.stringify(stat)}`);
    });

}

async function setBusySpot(worker, spot) {

    return new Promise((resolve, reject) => {

        logger.debug(`SETTING BUSY SPOT ${spot}`);

        waitForZookeeper();

        zClient.transaction().
        check(`/${worker}/free/${spot}`).
        remove(`/${worker}/free/${spot}`, -1).
        create(`/${worker}/busy/${spot}`).
        commit(function (error, results) {
            if (error) {
                if (results[0].err == -101) {
                    logger.debug(`Node is already busy`);
                    resolve(-1);
                } else {
                    logger.error(`Failed to execute the transaction: ${error} , ${JSON.stringify(results)}`);
                    reject();
                }
            } else {
                logger.debug(`Node: /${worker}/busy/${spot} is successfully created.`);
                resolve(spot);
            }
        });
    });
}

async function setFreeSpot(worker, spot) {

    return new Promise((resolve, reject) => {

        logger.debug(`SETTING FREE SPOT ${spot}`);

        waitForZookeeper();

        zClient.transaction().
        check(`/${worker}/busy/${spot}`).
        remove(`/${worker}/busy/${spot}`, -1).
        create(`/${worker}/free/${spot}`).
        commit(function (error, results) {
            if (error) {
                if (results[0].err == -101) {
                    logger.debug(`Node is already free`);
                    resolve(-1)
                } else {
                    logger.error(`Failed to execute the transaction: ${error} , ${JSON.stringify(results)}`);
                    reject();
                }
            } else {
                logger.debug(`Node: /${worker}/free/${spot} is successfully created.`);
                resolve(spot);
            }
        });
    });
}

async function setExecutingSpot(worker, spot, runtime) {

    return new Promise((resolve, reject) => {

        logger.debug(`SETTING EXECUTING SPOT ${spot} ${runtime}`);

        waitForZookeeper();

        zClient.transaction().
        check(`/${worker}/busy/${spot}/loaded`).
        check(`/${worker}/busy/${spot}/loaded/${runtime}`).
        remove(`/${worker}/busy/${spot}/loaded/${runtime}`, -1).
        remove(`/${worker}/busy/${spot}/loaded`, -1).
        create(`/${worker}/busy/${spot}/executing`).
        commit(function (error, results) {
            if (error) {
                if (results[0].err == -101) {
                    logger.debug(`Node not in loaded state`);
                    resolve(-1);
                } else if (results[1].err == -101) {
                    logger.debug(`Node loaded but with other runtime`);
                    resolve(-2);
                } else {
                    logger.error(`Failed to execute the transaction: ${error} , ${JSON.stringify(results)}`);
                    reject();
                }
            } else {
                logger.debug(`Node: /${worker}/busy/${spot}/executing is successfully created.`);
                resolve(spot);
            }
        });
    });
}

async function setLoadedSpot(worker, spot, runtime) {

    return new Promise((resolve, reject) => {

        logger.debug(`SETTING LOADED SPOT ${spot} ${runtime}`);

        waitForZookeeper();

        zClient.transaction().
        check(`/${worker}/busy/${spot}/executing`).
        remove(`/${worker}/busy/${spot}/executing`, -1).
        create(`/${worker}/busy/${spot}/loaded`).
        create(`/${worker}/busy/${spot}/loaded/${runtime}`).
        commit(function (error, results) {
            if (error) {
                if (results[0].err == -101) {
                    logger.debug(`Node is already loaded`);
                    resolve(-1);
                } else {
                    logger.error(`Failed to execute the transaction: ${error} , ${JSON.stringify(results)}`);
                    reject();
                }
            } else {
                logger.debug(`Node: /${worker}/busy/${spot}/loaded/${runtime} is successfully created.`);
                resolve(spot);
            }
        });
    });
}

async function removeLoaded(worker, spot) {

    return new Promise(async (resolve, reject) => {

        logger.debug(`REMOVING LOADED SPOT ${worker} ${spot}`);

        waitForZookeeper();

        await zClient.removeRecursive(`/${worker}/busy/${spot}/loaded`, -1, async function (error) {
            if (error) {
                if (error.getCode() == zookeeper.Exception.NO_NODE) {
                    logger.verbose(`Node: /${worker}/busy/${spot} is not in loaded state`);
                    resolve(-1);
                } else {
                    logger.error(`Failed to execute the transaction: ${error.stack}`);
                    reject(error.stack);
                }
            } else {
                logger.debug(`Node: /${worker}/busy/${spot}/loaded is successfully recursively removed.`);

                var res = await createPath(`/${worker}/busy/${spot}/executing`).catch((err) => {
                    logger.error(`create path failed due to error ${err}`);
                });
                if (res == -1 || res == undefined) {
                    reject(undefined);
                } else {
                    resolve(spot);
                }
            }
        });
    });

}

async function setExecStart(worker, spot) {

    return new Promise((resolve, reject) => {

        logger.debug(`SETTING START INTO EXEC SPOT ${spot}`);

        waitForZookeeper();

        zClient.transaction().
        check(`/${worker}/busy/${spot}/started`).
        remove(`/${worker}/busy/${spot}/started`, -1).
        create(`/${worker}/busy/${spot}/executing`).
        commit(function (error, results) {
            if (error) {
                if (results[0].err == -101) {
                    logger.debug(`Node already started`);
                    resolve(-1);
                } else {
                    logger.error(`Failed to execute the transaction: ${error} , ${JSON.stringify(results)}`);
                    reject();
                }
            } else {
                logger.debug(`Node: /${worker}/busy/${spot}/executing is successfully created.`);
                resolve(spot);
            }
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

    logger.debug(`FETCHING FUNCTION ${funcName}`);

    var sendMsg = {}
    sendMsg.msgType = 'fetchFunction';
    sendMsg.content = funcName;
    sockDB.send(JSON.stringify(sendMsg));

}

function storeFunction(body) {
    logger.debug(`STORING FUNCTION ${JSON.stringify(body)}`);
    functionStore[body.function.functionName] = body;
    logger.debug(`STORE ${JSON.stringify(functionStore)}`);

    if (invokePolicy == 'PRELOAD_FUNCTION') {
        updateBaseTarget();
    }

}

function prepareCall(body) {

    var timing = new Date().getTime();
    body.timing.worker = timing;

    logger.debug(`PREPARING CALL ${JSON.stringify(body)}`);

    const callNum = body.callNum;
    const funcName = body.funcName;

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
    } else if (invokePolicy == 'PRELOAD_RUNTIME' || invokePolicy == 'PRELOAD_FUNCTION') {
        checkWarmSpotAvailable(callObject);
    }

}

function enqueueCall(callObject) {

    callQueue.push(callObject);
    logger.debug('PUSHED TO CALLQUEUE');
    logger.debug(JSON.stringify(callQueue));

    checkSpots();

}

function storeWorker(envelope, worker) {
    logger.info(`Stored worker ${worker}`);
    logger.debug(`STORE WORKER ${worker} // ${JSON.stringify(workerStore)}`);
    workerStore[worker].env = envelope;
}


// NO PRELOAD

async function checkSpots() {

    // check if there are calls in the queue

    if (callQueue.length == 0) {
        logger.debug('Call queue empty');
        return;
    }

    // check if the call has a suitable spot

    var spot = await getFirstFreeSpot();

    logger.debug(`SELECTED SPOT ${spot}`);

    if (spot == -1) {
        logger.verbose('No available spots');
    } else {
        if (callQueue.length == 0) {
            logger.verbose('Call queue empty');
            parent = spots['spot' + spot].parent;
            await setFreeSpot(parent, spot).catch((err) => {
                logger.error(err);
            });
            return;
        } else {
            selectFirstAvailable(spot);
        }
    }

}

async function selectFirstAvailable(spot) {

    // Select the call 

    callObject = callQueue.shift();

    var parent = spots['spot' + spot].parent;

    spots['spot' + spot].callNum = callObject.callNum;
    spots['spot' + spot].status = 'ASSIGNED';

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    // Send to execute

    var sendMsg = {}
    sendMsg.msgType = 'executeNoPreload';
    sendMsg.content = callObject;
    sendMsg.spot = spot;
    sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);

}

async function getFirstFreeSpot() {
    logger.debug(`GET FREE FIRST SPOT`);
    for (var i = 0; i < workerCount; i++) {
        var workerId = 'worker' + i;
        for (var j = 0; j < workerStore[workerId].spots.length; j++) {
            var res = await setBusySpot(workerId, workerStore[workerId].spots[j])
                .catch((err) => {
                    logger.error(err);
                });
            logger.debug(`RES ${res}`);
            if (res != undefined && res != -1) {
                return res;
            }
        }
    }
    return -1;
}

async function liberateSpot(spot) {

    logger.debug(`Liberating spot ${spot}`);

    var parent = spots['spot' + spot].parent;

    await setFreeSpot(parent, spot).catch((err) => {
        logger.error(err);
    });

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    checkSpots();

}


// PRELOAD RUNTIME & FUNCTIONS COMMON

function checkWindows() {

    logger.verbose('Checking window');

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
            if (rt == undefined) {
                continue;
            }
            counts[rt] = counts[rt] ? counts[rt] + 1 : 1;
        }

        logger.debug(`counts ${JSON.stringify(counts)}`);

        countsSorted = Object.keys(counts).sort(function (a, b) {
            return counts[b] - counts[a]
        })

        logger.debug(`countSorted ${JSON.stringify(countsSorted)}`);
        logger.debug(`SPOTS ${JSON.stringify(spots)}`);
        logger.debug(`CALLQUEUE ${callQueue}`)

        // para la ponderación cuento ticks 1/spotCount y asigno el mayor a un ceil y sucesivamente

        var assigned = 0;
        var mark = 0;

        while (assigned < spotCount) {

            logger.verbose(`${countsSorted[mark]} ${(counts[countsSorted[mark]] / windowArray.length)} %`);

            var assignations = Math.round((counts[countsSorted[mark]] / windowArray.length) * spotCount);
            assignations = assignations + assigned

            for (var i = assigned; i < assignations && assigned < spotCount; i++) {
                target['spot' + i] = [countsSorted[mark]];
                assigned = assigned + 1;
            }

            mark = mark + 1

        }

    }

    logger.verbose(`Target ${JSON.stringify(target)}`);

    if (callQueue.length > 0) {
        if (queueStucked == callQueue[0]) {
            refreshSpots(false);
        }
        queueStucked = callQueue[0];
    } else {
        queueStucked = {};
    }

    // si hay llamadas se ponderan y se actualiza target como sea necesario.

    // iniciar los spots        

}

async function refreshSpots(allSpots) {

    while (target['spot0'] == null) {
        setTimeout(function () {
            logger.debug('target not set')
        }, 1000);
    }

    logger.debug('REFRESHING SPOTS');

    logger.debug(`TRY TO REFRESH`);
    var flag = false;
    for (var i = 0; i < workerCount; i++) {
        var workerId = 'worker' + i;
        for (var j = 0; j < workerStore[workerId].spots.length; j++) {
            var selSpot = workerStore[workerId].spots[j]

            logger.debug(`trying to refresh spot ${selSpot}`);

            var res = await removeLoaded(workerId, selSpot)
                .catch((err) => {
                    if (err != undefined){
                        logger.error(err);
                    }
                });
            logger.debug(`RES ${res}`);
            if (res != undefined && res != -1) {
                flag = true;

                logger.debug(`SELECTED SPOT ${selSpot}`);

                var parent = spots['spot' + selSpot].parent;

                var sendMsg = {}
                sendMsg.msgType = 'forceRemoveSpot';
                sendMsg.containerName = spots['spot' + selSpot].containerName;
                sendMsg.content = spots['spot' + selSpot].content;
                sendMsg.spot = selSpot;
                sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);
                logger.verbose(`refreshed spot ${selSpot}`);

                if (!allSpots) {
                    return;
                }
            }
        }
    }
    if (flag) {
        logger.verbose(`refreshed all spots`);
        return true;
    }
    logger.verbose('Everything busy');
}

async function updateBaseTarget() {

    if (invokePolicy == 'PRELOAD_RUNTIME') {
        if (runtimePool.length > spotCount) {
            return;
        }

        for (var i = 0; i < spotCount; i++) {
            for (var j = 0; j < runtimePool.length && i < spotCount; j++) {
                var i = i + j;
                baseTarget['spot' + i] = runtimePool[j];
            }
        }
    } else if (invokePolicy == 'PRELOAD_FUNCTION') {
        if (functionPool.length > spotCount) {
            return;
        }

        for (var i = 0; i < spotCount; i++) {
            for (var j = 0; j < functionPool.length && i < spotCount; j++) {
                var i = i + j;
                baseTarget['spot' + i] = functionPool[j];
            }
        }
    }


    logger.verbose(`baseTarget ${JSON.stringify(baseTarget)}`);
    checkWindows();

    // refrescar los loaded para aplicar el nuevo target. Iniciar los started
    await startIntoExec();

    await refreshSpots(true);

}

async function startIntoExec() {
    logger.debug(`START INTO EXEC`);
    for (var i = 0; i < workerCount; i++) {
        var workerId = 'worker' + i;
        for (var j = 0; j < workerStore[workerId].spots.length; j++) {
            var res = await setExecStart(workerId, workerStore[workerId].spots[j])
                .catch((err) => {
                    logger.error(err);
                });
            logger.debug(`RES ${res}`);
            if (res != undefined && res != -1) {
                backFromExecution(res);
            }
        }
    }
}

function backFromExecution(spot) {

    logger.debug(`BACK FROM EXEC ${spot}`)

    // check if there are calls in the queue

    if (callQueue.length > 0) {
        try {
            callObject = callQueue.shift();

            var parent = spots['spot' + spot].parent;

            // No se refresca porque sigue executing a ojos del señor

            spots['spot' + spot].callNum = callObject.callNum;
            spots['spot' + spot].status = 'ASSIGNED';

            logger.debug(`SPOTS ${JSON.stringify(spots)}`);

            var sendMsg = {}
            sendMsg.msgType = 'executeNoPreload';
            sendMsg.content = callObject;
            sendMsg.spot = spot;
            sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);
            refreshSpots(false);
        } catch (err) {
            logger.error(err);
        }
    } else {

        if (target['spot0'] != null) {

            if (invokePolicy == 'PRELOAD_RUNTIME') {

                sendSpotToPreloadRuntime(spot);

            } else if (invokePolicy == 'PRELOAD_FUNCTION') {

                sendSpotToPreloadFunction(spot);

            }

        } else {
            logger.verbose(`No target so no preloading`);
        }

    }

}

async function backFromPreloading(spot, content) {

    logger.debug(`BACK FROM PRELOADING ${spot}`)

    var parent = spots['spot' + spot].parent;

    await setLoadedSpot(parent, spot, content)
        .catch((err) => { 
            // settear el flag si ha encontrado un loaded con un runtime diferente
            logger.error(err);
        });
}

async function checkWarmSpotAvailable(callObject) {

    var warmContent = '';

    // Añadir el timing (insertedCall) y el runtime a la array de windowArray.
    if (invokePolicy == 'PRELOAD_RUNTIME') {
        warmContent = callObject.runtime;
    } else if (invokePolicy == 'PRELOAD_FUNCTION') {
        warmContent = callObject.funcName;
    }
    windowArray.push([warmContent, callObject.insertedCall.timing.api, callObject.callNum]);

    logger.debug(`WINDOWARRAY ${windowArray}`);

    // Recorrer todos los spots para ver si hay alguno que tenga el runtime del callobject.
    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    var spot = await getFirstSuitableWarmSpot(warmContent);

    logger.debug(`SELECTED SPOT ${spot}`);

    if (spot == -1) {
        logger.verbose('Every spot is busy (not loaded)');
        callQueue.push(callObject);
        logger.debug('PUSHED TO CALLQUEUE');
        logger.debug(JSON.stringify(callQueue));
    } else if (spot == -2) {
        logger.verbose('Didnt find a suitable loaded spot. Removing one random loaded');
        callQueue.push(callObject);
        logger.debug('PUSHED TO CALLQUEUE');
        refreshSpots(false);
    } else {

        spots['spot' + spot].callNum = callObject.callNum;
        spots['spot' + spot].status = 'EXECUTING';
        callObject.containerName = spots['spot' + spot].containerName;

        logger.debug(`SPOTS ${JSON.stringify(spots)}`);

        var parent = spots['spot' + spot].parent;

        if (invokePolicy == 'PRELOAD_RUNTIME') {
            var sendMsg = {}
            sendMsg.msgType = 'execRtPreloaded';
            sendMsg.content = callObject;
            sendMsg.spot = spot;
            sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);
        } else if (invokePolicy == 'PRELOAD_FUNCTION') {
            var sendMsg = {}
            sendMsg.msgType = 'execFuncPreloaded';
            sendMsg.content = callObject;
            sendMsg.spot = spot;
            sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);
        }
    }
}

async function getFirstSuitableWarmSpot(warmContent) {
    logger.debug(`GET FREE SUITABLE WARM SPOT`);
    var flag = false
    for (var i = 0; i < workerCount; i++) {
        var workerId = 'worker' + i;
        for (var j = 0; j < workerStore[workerId].spots.length; j++) {
            var res = await setExecutingSpot(workerId, workerStore[workerId].spots[j], warmContent)
                .catch((err) => {
                    logger.error(err);
                });

            logger.debug(`RES ${res}`);
            if (res != undefined && res != -1) {
                if (res == -2) {
                    flag = true
                } else {
                    return res;
                }
            }
        }
    }
    // devolver dependiendo del flag
    if (flag) {
        return -2;
    }
    return -1;
}

async function setIntoStart(spot) {

    logger.verbose(`Setting spot ${spot} into start`);

    var parent = spots['spot' + spot].parent;

    await createPath(`/${parent}/busy/${spot}/started`);

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    backFromExecution(spot);

}


// PRELOAD RUNTIME

function sendSpotToPreloadRuntime(spot) {


    logger.debug(`LOADING ${JSON.stringify(spots)}`);

    var parent = spots['spot' + spot].parent;

    spots['spot' + spot].callNum = '';
    spots['spot' + spot].containerName = `pre${spots['spot' + spot].multiplier * spotCount + spot}-${target['spot' + spot]}`;
    spots['spot' + spot].status = 'LOADING_RT';
    spots['spot' + spot].content = target['spot' + spot];
    spots['spot' + spot].multiplier = spots['spot' + spot].multiplier + 1

    logger.debug(`LOADING CONTAINER ${spots['spot' + spot].containerName} in SPOT ${spot}`);

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    var callObject = {
        "runtime": target['spot' + spot],
        "registryIP": registryIP,
        "registryPort": registryPort,
        "containerName": spots['spot' + spot].containerName
    }

    var sendMsg = {}
    sendMsg.msgType = 'preloadRuntime';
    sendMsg.content = callObject;
    sendMsg.spot = spot;
    sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);

}


// PRELOAD FUNCTION

function sendSpotToPreloadFunction(spot) {


    logger.debug(`LOADING ${JSON.stringify(spots)}`);

    var parent = spots['spot' + spot].parent;

    spots['spot' + spot].callNum = '';
    spots['spot' + spot].containerName = `pre${spots['spot' + spot].multiplier * spotCount + spot}-${target['spot' + spot]}`;
    spots['spot' + spot].status = 'LOADING_FUN';
    spots['spot' + spot].content = target['spot' + spot];
    spots['spot' + spot].multiplier = spots['spot' + spot].multiplier + 1

    logger.debug(`LOADING CONTAINER ${spots['spot' + spot].containerName} in SPOT ${spot}`);

    logger.debug(`SPOTS ${JSON.stringify(spots)}`);

    var callObject = {
        "runtime": functionStore[target['spot' + spot]].function.runtimeName,
        "registryIP": registryIP,
        "registryPort": registryPort,
        "containerName": spots['spot' + spot].containerName,
        "funcName": target['spot' + spot],
        "containerPath": functionStore[target['spot' + spot]].runtime.path,
        "runtimeDeps": functionStore[target['spot' + spot]].runtime.dependencies
    }

    var sendMsg = {}
    sendMsg.msgType = 'preloadFunction';
    sendMsg.content = callObject;
    sendMsg.spot = spot;
    sockRou.send([workerStore[parent].env, JSON.stringify(sendMsg)]);

}


// Event handling
//----------------------------------------------------------------------------------//

sockReq.on('message', function (msg) {
    logger.debug(`MESSAGE REP ${msg}`);
});

sockSub.on('message', function (msg) {
    logger.debug(`MESSAGE PUB ${msg}`);

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
    logger.debug(`MESSAGE DB ${msg}`);
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
    logger.debug(`MESSAGE ROU ${msg}`);
    logger.debug(`ENVELOPE ROU ${envelope}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'ready':
            logger.debug('received envelope');
            storeWorker(envelope, msg.content);
            break;
        case 'liberateSpot':
            logger.debug('liberating spot');
            liberateSpot(msg.content);
            break;
        case 'backFromExecution':
            logger.debug('back from execution');
            backFromExecution(msg.content);
            break;
        case 'backFromPreloading':
            logger.debug('back from preloading');
            backFromPreloading(msg.spot, msg.content);
            break;
        case 'setIntoStart':
            logger.debug('Setting spot into exec');
            setIntoStart(msg.content);
            break;
    }
});

sockReqBrk.on('message', function (msg) {
    logger.debug(`MESSAGE REQBRK ${msg}`);
    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'register':
            registerWorker(msg.content);
            break;
    }
});