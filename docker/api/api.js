// Libraries
//----------------------------------------------------------------------------------//

const express = require('express')
const bodyParser = require('body-parser')
var logger = require('winston');
var multer = require('multer');
var cors = require('cors');
var del = require('del');
var utils = require('./utils');
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
logger.info(`conf: ${JSON.stringify(faasConf)}`);


// Multer

const UPLOAD_PATH = 'uploads';
const CALLS_PATH = 'calls';
const upload = multer({
    dest: `${UPLOAD_PATH}/`
});


// Express

const app = express()
app.use(cors());
app.use(bodyParser.json())
const port = faasConf.express;


// Zmq

const registryIP = faasConf.registry.ip;
const registryPort = faasConf.registry.port;
const addressRep = `tcp://*:${faasConf.zmq.apiRep.port}`;
const addressPub = `tcp://*:${faasConf.zmq.apiPub.port}`;
const addressDB = `tcp://${faasConf.zmq.db.ip}:${faasConf.zmq.db.port}`;

var sockRep = zmq.socket('rep');
sockRep.bindSync(addressRep);
logger.info(`ZMQ REPLY ON ${addressRep}`);

var sockPub = zmq.socket('pub');
sockPub.bindSync(addressPub);
logger.info(`ZMQ PUB ON ${addressPub}`);

var sockDB = zmq.socket('req');
sockDB.connect(addressDB);
logger.info(`ZMQ DB ON ${addressDB}`);


// Uploads

const cleanFolder = function (folderPath) {
    // delete files inside folder but not the folder itself
    del.sync([`${folderPath}/**`, `!${folderPath}`]);
};

cleanFolder(UPLOAD_PATH);
cleanFolder(CALLS_PATH);


// Data structures

var callNum = 0;
var runtimeList = [];
var functionList = [];
var callStore = {};


// other

const invokePolicy = faasConf.invokePolicy;

// API
//----------------------------------------------------------------------------------//

// GET FUNCTIONS

app.get('/functions', function (req, res) {

    logger.http(`GET FUNCTIONS`);
    res.send(functionList);

});


// GET RUNTIMES

app.get('/runtimes', function (req, res) {

    logger.http(`GET RUNTIMES`);
    res.send(runtimeList);

});


// GET CALLS

app.get('/calls', function (req, res) {

    logger.http(`GET CALLS`);
    res.send(JSON.stringify(callStore));

});


// GET CALLNUM

app.get('/call/:callNum', function (req, res) {

    logger.http(`GET CALL ${req.params.callNum}`);

    res.send(JSON.stringify(callStore['c' + req.params.callNum]));

});


// POST REGISTERRUNTIME

app.post('/registerRuntime', async function (req, res) {

    try {

        logger.http(`REGISTER RUNTIME ${req.body.image}`);

        logger.debug(JSON.stringify(req.body));
        logger.debug(req.body.image);
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

            logger.debug(`image ${img} uploaded to registry`);
            logger.verbose(`Runtime ${img} registered`);

            transmitRuntime(img);

            res.sendStatus(200);
            return;
        } else {
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

    logger.http(`REGISTER FUNCTION ${req.params.functionName} OF RUNTIME ${req.params.runtimeName}`);

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

            // FIXME: que esto funcione con docker distribuido (diversos docker daemons) lel

            // var folderName = body.function.runtimeName + '/' + body.function.functionName;
            // logger.debug(`function Name ${folderName}`)

            // // Create a folder to hold the function contents
            // var commandline = `mkdir -p uploads/${body.function.runtimeName}`
            // utils.executeSync(logger, commandline);

            // // extract the file on the newly created folder
            // var commandline = `docker cp faas-api:/ws/uploads/${folderName} /ws/uploads/uploads/${body.function.runtimeName}`
            // utils.executeSync(logger, commandline);

            transmitFunction(req.file.functionName);

            res.sendStatus(200);
            return;
        } else {
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

    var timing = new Date().getTime();

    callNum = callNum + 1;

    var funcName = req.body.funcName;
    var params = req.body.params;

    logger.http(`INVOKING ${funcName} WITH PARAMS ${JSON.stringify(params)}`);

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

    insert = {
        "funcName": req.body.funcName,
        "params": req.body.params,
        "callNum": callNum,
        "status": 'PENDING',
        "result": '',
        "timing": {
            "api": timing
        }
    }

    var sendMsg = {}
    sendMsg.msgType = 'insertCall';
    sendMsg.content = insert;
    sockDB.send(JSON.stringify(sendMsg));

    transmitCall(insert);

    index = 'c' + callNum;

    callStore[index] = {};

    callStore[index].callNum = insert.callNum;
    callStore[index].funcName = insert.funcName;
    callStore[index].status = insert.status;
    callStore[index].result = insert.result;
    callStore[index].timing = insert.timing;

    logger.debug(`callstore ${JSON.stringify(callStore)}`);

    res.send('' + callNum);
});


// Functions
//----------------------------------------------------------------------------------//

function updateCall(body) {

    var timing = new Date().getTime();
    body.timing.result = timing;

    index = 'c' + body.callNum;

    callStore[index].status = body.status;
    callStore[index].result = body.result;
    callStore[index].timing = body.timing;

    fixTiming(index);

    logger.debug(`callstore ${JSON.stringify(callStore)}`);
    sockRep.send('call updated on API');
}

function fixTiming(index) {

    var times = callStore[index].timing;
    var base = times.api;
    var newtimes = {};
    newtimes.api = 0;
    newtimes.worker = times.worker - base;
    newtimes.queue = times.queue - base;
    newtimes.runtime = times.runtime - base;
    newtimes.function = times.function-base;
    newtimes.result = times.result - base;

    callStore[index].timing = newtimes;

}

function transmitRuntime(img) {

    logger.verbose(`TRANSMITTING RUNTIME ${img}`);

    var sendMsg = {}
    sendMsg.msgType = 'runtime';
    sendMsg.content = img;
    sockPub.send(JSON.stringify(sendMsg));

}

function transmitFunction(func) {

    logger.verbose(`TRANSMITTING FUNCTION ${func}`);

    var sendMsg = {}
    sendMsg.msgType = 'function';
    sendMsg.content = func;
    sockPub.send(JSON.stringify(sendMsg));

}

function transmitCall(call) {

    logger.verbose(`TRANSMITTING CALL ${call}`);

    var sendMsg = {}
    sendMsg.msgType = 'call';
    sendMsg.content = call;
    sockPub.send(JSON.stringify(sendMsg));

}


// Event handling
//----------------------------------------------------------------------------------//

sockRep.on("message", function (msg) {

    logger.debug(`SOCKREP ${msg}`)

    msg = JSON.parse(msg);

    switch (msg.msgType) {
        case 'updateCall':
            updateCall(msg.content);
            break;
    }

});


sockDB.on("message", function (msg) {

    logger.debug(`SOCKDB ${msg}`);

});


// Server start
//----------------------------------------------------------------------------------//

app.listen(port, () => logger.info(`FaaS listening at http://localhost:${port}`))


// Signal handling
//----------------------------------------------------------------------------------//

process.on('SIGINT', function () {
    logger.debug('Received SIGINT');

    db.saveDatabase(function (err) {
        if (err) {
            logger.error("error : " + err);
        } else {
            logger.verbose("database saved.");
            process.exit();
        }
    });

});