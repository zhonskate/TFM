// LIBRARIES

const express = require('express')
const bodyParser = require('body-parser')
var logger = require('winston');
var multer = require('multer');
var cors = require('cors');
var Loki = require('lokijs');
var del = require('del');
const {
    execSync
} = require('child_process');
var utils = require('./utils');
var invoke = require('./invoke');
var zmq = require('zeromq');
const fs = require('fs');
const EventEmitter = require('events');
const myEmitter = new EventEmitter();


// LOGGER-RELATED DECLARATIONS

logger.level = 'debug';

const myformat = logger.format.combine(
    logger.format.colorize(),
    logger.format.timestamp(),
    logger.format.printf(info => `[API] ${info.timestamp} ${info.level}: ${info.message}`)
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

/* logger.log('silly', '6: silly');
logger.log('debug', '5: debug');
logger.log('verbose', '4: verbose');
logger.log('http', '3: http');
logger.log('info', '2: info');
logger.log('warn', '1: warn');
logger.log('error', '0: error'); */

// DB-RELATED DECLARATIONS

const DB_NAME = 'db.json';
const COLLECTION_FUNCTIONS = 'functions';
const COLLECTION_RUNTIMES = 'runtimes';
const COLLECTION_CALLS = 'calls';
const UPLOAD_PATH = 'uploads';
const CALLS_PATH = 'calls';
const upload = multer({
    dest: `${UPLOAD_PATH}/`
}); // multer configuration
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, {
    persistenceMethod: 'fs'
});

// EXPRESS CONF

const app = express()
app.use(cors());
app.use(bodyParser.json())

// OTHER DECLARATIONS

const port = 3000
var registryIP = 'localhost';
var registryPort = '5000';
var colFunctions, colCalls, colRuntimes;
const INVOKE_MODE = 'PRELOAD_NOTHING';
const addressRep = process.env.ZMQ_BIND_ADDRESS || `tcp://*:2000`;
const addressPub = process.env.ZMQ_BIND_ADDRESS || `tcp://*:2001`;
const addressDB = process.env.ZMQ_BIND_ADDRESS || `tcp://faas-db:2002`;

// zmq init

var sockRep = zmq.socket('rep');
sockRep.bindSync(addressRep);

logger.info(`ZMQ REPLY ON ${addressRep}`);

var sockPub = zmq.socket('pub');
sockPub.bindSync(addressPub);

logger.info(`ZMQ PUB ON ${addressPub}`);

var sockDB = zmq.socket('req');
sockDB.connect(addressDB);

logger.info(`ZMQ DB ON ${addressDB}`);

// FIXME: Cambiarlo por algo con sentido
// var callNum = Math.floor(Math.random() * 10000);
var callNum = 0;
var callQueue = [];
var runtimeList = [];
var functionList = [];

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
// GET FUNCTIONS

app.get('/functions', function (req, res) {

    // Montar un express en DB y redirigir

    logger.info(`GET FUNCTIONS`);
    sol = dbDriver.getAllFunctions();
    res.send(sol);

});


// GET RUNTIMES

app.get('/runtimes', function (req, res) {

    logger.info(`GET RUNTIMES`);
    sol = dbDriver.getAllRuntimes();
    res.send(sol);

});


// GET CALLS

app.get('/calls', function (req, res) {
    
    logger.info(`GET CALLS`);
    sol = dbDriver.getAllCalls();
    res.send(sol);

});


// POST REGISTERRUNTIME

app.post('/registerRuntime', async function (req, res) {

    try {

        logger.info(`REGISTER RUNTIME ${req.body.image}`);

        //TODO: Asignar una ruta para la descompresión de archivos de función.

        // {image:<imageName>, path: <path>}

        logger.log('debug', JSON.stringify(req.body));
        logger.log('debug', req.body.image);
        logger.debug(req.body.path);
        img = req.body.image;
        path = req.body.path;
        deps = req.body.dependencies;
        runCommand = req.body.run;


        // check de parámetros
        if (img == undefined || path == undefined || deps == undefined || runCommand == undefined) {
            logger.warn('USAGE image:<imageName>, path: <path>, dependencies: <deps>, run: <run command>');
            logger.warn('See the examples')
            res.sendStatus(400);
            return;
        }

        // check del runtime name
        if (utils.validName(logger, img) == false) {
            logger.warn('no special characters allowed on runtime name');
            res.sendStatus(400);
            return;
        }

        // check if runtime is present in the DB
        // if we want to make the api

        if (runtimeList.includes(img) == false) {
            var sendMsg = {}
            sendMsg.msgType = 'insertRuntime';
            sendMsg.content = req.body;
            sockDB.send(JSON.stringify(sendMsg));
            runtimeList.push(img);
            // tag image
            var commandline = `\
            docker \
            tag \
            ${img} ${registryIP}:${registryPort}/${img}`
            utils.executeSync(logger, commandline);

            // push the image to the registry
            var commandline = `\
            docker \
            push \
            ${registryIP}:${registryPort}/${img}`
            utils.executeSync(logger, commandline);

            logger.info(`image ${img} uploaded to registry`);
            // return the status

            transmitRuntime(img);

            res.sendStatus(200);
            return;
        }
        else {
            logger.warn('runtime already registered');
            res.sendStatus(400);
            return;
        }

    } catch (err) {
        logger.error(err);
        res.sendStatus(400);
    }
});


// POST REGISTERFUNCTION

app.post('/registerFunction/:runtimeName/:functionName', upload.single('module'), async (req, res, next) => {

    logger.info(`REGISTER FUNCTION ${req.params.functionName} OF RUNTIME ${req.params.runtimeName}`);

    // TODO: assign function to runtime

    // receive from http
    try {
        req.file.functionName = req.params.functionName;
        req.file.runtimeName = req.params.runtimeName;
        logger.debug(JSON.stringify(req.file))

        if (utils.validName(logger, req.file.functionName) == false) {
            logger.warn('no special characters allowed on function name');

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            utils.executeSync(logger, commandline);
            res.sendStatus(400);
            return;
        }

        //check if runtime exists
        if (runtimeList.includes(req.file.runtimeName) == false) {
            logger.warn(`Inexistent runtime`);

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            utils.executeSync(logger, commandline);
            res.sendStatus(400);
            return;
        }


        //check if function is registered.
        //TODO: Accept versions of the same function, maybe other API route

        if (functionList.includes(req.params.functionName) == false) {
            var sendMsg = {}
            sendMsg.msgType = 'insertFunction';
            sendMsg.content = req.file;
            sockDB.send(JSON.stringify(sendMsg));
            functionList.push(req.params.functionName);
            logger.debug(`functionList ${functionList}`);
            var folderName = req.file.runtimeName + '/' + req.file.functionName;
            logger.debug(`function Name ${folderName}`)

            // Create a folder to hold the function contents
            var commandline = `mkdir -p uploads/${folderName}`
            utils.executeSync(logger, commandline);

            // extract the file on the newly created folder
            var commandline = `tar -C uploads/${folderName} -zxf uploads/${req.file.filename}`
            utils.executeSync(logger, commandline);

            // create the sha of the tgz
            // var tarfile = fs.readFileSync(req.file.path, 'utf8');
            // var hash = sha256(tarfile);


            // prepare folder to build the image
            /* fs.rename(req.file.path,'./build/module.tar.gz',function(error, stdout, stderr){
                if(error){console.log(error);}
                if(stderr){console.log(stderr);}
                if(stdout){console.log(stdout);}
            }) */

            transmitFunction(req.file.functionName);

            res.sendStatus(200);
            return;
        }
        else {
            logger.warn('function already registered');
            res.sendStatus(400);
            return;
        }

    } catch (err) {
        logger.error(err);
        res.sendStatus(400);
    }

});


// POST INVOKEFUNCTION

app.post('/invokeFunction', async function (req, res) {

    callNum = callNum + 1;

    // TODO: Segmentate method.

    var funcName = req.body.funcName;
    var params = req.body.params;

    logger.info(`INVOKING ${funcName} WITH PARAMS ${JSON.stringify(params)}`);

    // check arguments are present
    if (funcName == undefined || params == undefined) {
        logger.warn('INCORRECT ARGUMENTS')
        res.sendStatus(400);
    }

    // check if function exists
    if (functionList.includes(funcName) == false) {
        logger.warn(`Function does not exist`);
        res.sendStatus(400);
        return;
    }
    logger.debug(`object func ${JSON.stringify(funcQuery)}`);
    var runtime = funcQuery[0].runtimeName;
    logger.debug(`runtime ${runtime}`);

    // look for the runtime specs
    var runQuery = colRuntimes.where(function (obj) {
        return obj.image == runtime;
    });

    insert = {
        "funcName": req.body.funcName,
        "params": req.body.params,
        "callNum": callNum,
        "status": 'placeholder',
        "result": ''
    }

    var sendMsg = {}
    sendMsg.msgType = 'insertCall';
    sendMsg.content = insert;
    sockDB.send(JSON.stringify(sendMsg));

    var containerPath = runQuery[0].path;
    var runtimeRunCmd = runQuery[0].run;
    var runtimeDeps = runQuery[0].dependencies;
    logger.debug(`object runtime ${JSON.stringify(runQuery)}`);
    logger.debug(`container path ${containerPath}`);

    // save the parameters to a file

    // create the folder
    var commandline = `mkdir -p ${CALLS_PATH}/${callNum}`;
    utils.executeSync(logger, commandline);

    // add an info file
    fileObject = {
        "runtime": runtime,
        "function": funcName
    };
    var commandline = `echo '${JSON.stringify(fileObject)}' > ${CALLS_PATH}/${callNum}/info.json`
    utils.executeSync(logger, commandline);

    // create the params file
    var commandline = `echo '${JSON.stringify(params)}' > ${CALLS_PATH}/${callNum}/input.json`
    utils.executeSync(logger, commandline);

    // prepare the object

    let callObject = {
        "runtime":runtime,
        "registry":`${registryIP}:${registryPort}`,
        "callNum":callNum,
        "funcName":funcName,
        "containerPath":containerPath,
        "runtimeDeps":runtimeDeps,
        "runtimeRunCmd":runtimeRunCmd,
        "insertedCall":insertedCall
    }

    callQueue.push(callObject);
    logger.debug('PUSHED TO CALLQUEUE');
    logger.debug(callQueue);


    // TODO: SPLIT the method here and sort out the invocation policies.

    // myEmitter.emit('event', runtime, registryIP, registryPort, callNum, funcName, containerPath, runtimeDeps, runtimeRunCmd, insertedCall);

    res.send('' + callNum);
});


// SERVER START

app.listen(port, () => logger.log('info', `FaaS listening at http://localhost:${port}`))

// EVENT HANDLING

myEmitter.on('event', function(runtime, registryIP, registryPort, callNum, funcName, containerPath, runtimeDeps, runtimeRunCmd, insertedCall) {
    switch (INVOKE_MODE) {
        case 'PRELOAD_NOTHING':
            invoke.preloadNothing(logger, runtime, registryIP, registryPort, callNum, funcName, containerPath, runtimeDeps, runtimeRunCmd, insertedCall, CALLS_PATH)
            .then((insertedCall) => {
                logger.debug(`INSERTED CALL ${JSON.stringify(insertedCall)}`);
                logger.debug(`COL CALL ${JSON.stringify(colCalls)}`);
                colCalls.update(insertedCall);
            });
            break;
        case 'PRELOAD_RUNTIME':
            invoke.preloadRuntime();
            break;
        case 'PRELOAD_FUNCTION':
            invoke.preloadFunction()
            break;
    }
});

// ZMQ

sockRep.on("message",function(msg){

    logger.info(`SOCKREP ${msg}`);
    sockRep.send('world');

});

sockDB.on("message",function(msg){

    logger.info(`SOCKDB ${msg}`);

});

function transmitRuntime(img){

    logger.verbose(`TRANSMITTING RUNTIME ${img}`);

    sockPub.send(`RUNTIME///${img}`);

}

function transmitFunction(func){

    logger.verbose(`TRANSMITTING FUNCTION ${func}`);

    sockPub.send(`FUNCTION///${func}`);

}

//----------------------------------------------------------------------------------//
// SIGNAL HANDLING

process.on('SIGINT', function () {
    logger.info('Received SIGINT');

    db.saveDatabase(function (err) {
        if (err) {
            logger.error("error : " + err);
        } else {
            logger.info("database saved.");
            process.exit();
        }
    });

});