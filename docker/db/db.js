// Libraries
//----------------------------------------------------------------------------------//

var Loki = require('lokijs');
const logger = require('winston');
var del = require('del');
var zmq = require('zeromq');
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
    logger.format.printf(info => `[DB-] ${info.timestamp} ${info.level}: ${info.message}`)
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


//Zmq

const addressReq = `tcp://*:${faasConf.zmq.db.port}`;

var sockRep = zmq.socket('rep');
sockRep.bindSync(addressReq);
logger.info(`ZMQ DB BOUND TO ${addressReq}`);


// Database

const DB_NAME = 'db.json';
const COLLECTION_FUNCTIONS = 'functions';
const COLLECTION_RUNTIMES = 'runtimes';
const COLLECTION_CALLS = 'calls';
const UPLOAD_PATH = 'uploads';
const CALLS_PATH = 'calls';
var colFunctions, colCalls, colRuntimes;
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, {
    persistenceMethod: 'fs'
});

const loadCollection = function (colName, db) {
    return new Promise(resolve => {
        db.loadDatabase({}, () => {
            const _collection = db.getCollection(colName) || db.addCollection(colName, {
                autoupdate: true
            });
            resolve(_collection);
        })
    });
}

const cleanFolder = function (folderPath) {
    // delete files inside folder but not the folder itself
    del.sync([`${folderPath}/**`, `!${folderPath}`]);
};

cleanFolder(UPLOAD_PATH);
cleanFolder(CALLS_PATH);

async function loadDBs() {
    colFunctions = await loadCollection(COLLECTION_FUNCTIONS, db);
    colRuntimes = await loadCollection(COLLECTION_RUNTIMES, db);
    colCalls = await loadCollection(COLLECTION_CALLS, db);
}

loadDBs().then(() => {
    logger.verbose('DBs loaded')
})


// Functions
//----------------------------------------------------------------------------------//

function getAllRuntimes() {

    // Deprecated

    var solArr = colRuntimes.where(function (obj) {
        return obj.image != '';
    });

    sol = [];

    for (i = 0; i < solArr.length; i++) {
        sol.push(solArr[i].image);
    }

    //logger.debug(sol);
    db.saveDatabase();

    return sol;
}

function getAllFunctions() {

    // Deprecated

    var solArr = colFunctions.where(function (obj) {
        return obj.functionName != '';
    });

    sol = [];

    for (i = 0; i < solArr.length; i++) {
        sol.push(solArr[i].functionName);
    }

    db.saveDatabase();

    return sol;

}

function getAllCalls() {

    // Deprecated

    var solArr = colCalls.where(function (obj) {
        return obj.status != '';
    });

    // TODO: Format

    res.send(solArr);

    db.saveDatabase();

    return sol;

}

function checkRuntimePresent() {
    var already = colRuntimes.where(function (obj) {
        return obj.image == img
    });
    logger.debug(already.length);
    if (already.length > 0) {
        logger.debug(`already ${JSON.stringify(already)}`);
        logger.warn(`runtime already registered`);
        return true;
    }
    return false;
}

function insertRuntime(body) {
    logger.debug(`insertRuntime ${JSON.stringify(body)}`)
    const data = colRuntimes.insert(body);
    db.saveDatabase();
    sockRep.send('done');
}

function insertFunction(body) {
    logger.debug(`insertFunction ${JSON.stringify(body)}`)
    const data = colFunctions.insert(body);
    db.saveDatabase();
    sockRep.send('done');
}

function fetchFunction(body) {
    logger.debug(`fetchFunction ${JSON.stringify(body)}`)
    logger.debug(`funcName ${body}`);

    // fetch the function
    var funcQuery = colFunctions.where(function (obj) {
        return obj.functionName == body;
    });
    // TODO: Debug funcQuery, get the results and send them back to the worker
    logger.debug(`funcQuery ${JSON.stringify(funcQuery)}`);

    // fetch the runtime as well
    var runtime = funcQuery[0].runtimeName;
    logger.debug(`runtime ${runtime}`);

    // look for the runtime specs
    var runQuery = colRuntimes.where(function (obj) {
        return obj.image == runtime;
    });

    db.saveDatabase();
    // send back the func info
    var sendMsg = {}
    sendMsg.msgType = 'fetchedFunction';
    sendMsg.content = {};
    sendMsg.content.function = funcQuery[0];
    sendMsg.content.runtime = runQuery[0];

    sockRep.send(JSON.stringify(sendMsg));
}

function insertCall(body) {
    logger.debug(`insertCall ${JSON.stringify(body)}`);
    const data = colCalls.insert(body);
    db.saveDatabase();
    sockRep.send('done');
}

function fetchCall(body) {
    logger.debug(`fetchCall ${JSON.stringify(body)}`)

    // fetch the call

    var callQuery = colCalls.where(function (obj) {
        return obj.callNum == body;
    });

    db.saveDatabase();
    // send back the call info
    var sendMsg = {}
    sendMsg.msgType = 'fetchedCall';
    sendMsg.content = callQuery[0];

    sockRep.send(JSON.stringify(sendMsg));
}

function updateCall(body) {

    let existingRecord = colCalls.chain().find({
        'callNum': body.callNum
    }).update(function (obj) {
        obj.status = body.status;
        obj.result = body.result;
    });

    if (!existingRecord) {
        logger.error('Tried to update an empty call');
        return;
    }

    db.saveDatabase();
    logger.debug(`EXISTING ${JSON.stringify(colCalls)}`);

    var sendMsg = {}
    sendMsg.msgType = 'insertedCall';
    sockRep.send(JSON.stringify(sendMsg));
}


// Event handling
//----------------------------------------------------------------------------------//

sockRep.on('message', function (msg) {

    logger.debug(`SOCKREP ${msg}`)

    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'checkRuntimePresent':
            checkRuntimePresent(msg.content);
            break;
        case 'insertRuntime':
            insertRuntime(msg.content);
            break;
        case 'insertFunction':
            insertFunction(msg.content);
            break;
        case 'fetchFunction':
            fetchFunction(msg.content);
            break;
        case 'insertCall':
            insertCall(msg.content);
            break;
        case 'fetchCall':
            fetchCall(msg.content);
            break;
        case 'updateCall':
            updateCall(msg.content);
            break;

    }
});