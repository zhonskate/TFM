var Loki = require('lokijs');
const logger = require('winston');
var del = require('del');
var zmq = require('zeromq');

// LOGGER-RELATED DECLARATIONS

logger.level = 'debug';

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

// DB-RELATED DECLARATIONS

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

//----------------------------------------------------------------------------------//
// Upload-related code

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

// TODO: DATABASE SAVING NOT WORKING
async function loadDBs() {
    colFunctions = await loadCollection(COLLECTION_FUNCTIONS, db);
    colRuntimes = await loadCollection(COLLECTION_RUNTIMES, db);
    colCalls = await loadCollection(COLLECTION_CALLS, db);
}

loadDBs().then(() => {
    logger.info('DBs loaded')
})

function getAllRuntimes() {
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

    var solArr = colCalls.where(function (obj) {
        return obj.status != '';
    });

    // TODO: Format

    res.send(solArr);

    db.saveDatabase();

    return sol;

}




var sockRep = zmq.socket('rep');
const addressReq = process.env.ZMQ_CONN_ADDRESS || `tcp://*:2002`;
sockRep.bind(addressReq);
logger.info(`DB Req binded to ${addressReq}`);

sockRep.on('message', function(msg){
    logger.info(`MESSAGE REQ ${msg}`);
});