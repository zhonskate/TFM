// LIBRARIES

const express = require('express')
const bodyParser = require('body-parser')
const logger = require('winston');
var multer = require('multer');
var cors = require('cors');
var Loki = require('lokijs');
var del = require('del');
const {
    execSync
} = require('child_process');
var utils = require('./utils');
const {
    validName
} = require('./utils');

// LOGGER-RELATED DECLARATIONS

logger.level = 'debug';

const myformat = logger.format.combine(
    logger.format.colorize(),
    logger.format.timestamp(),
    logger.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
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

// FIXME: Cambiarlo por algo con sentido
var callNum = Math.floor(Math.random() * 10000);

//----------------------------------------------------------------------------------//
// Upload-related code

const loadCollection = function (colName, db) {
    return new Promise(resolve => {
        db.loadDatabase({}, () => {
            const _collection = db.getCollection(colName) || db.addCollection(colName, { autoupdate: true });
            resolve(_collection);
        })
    });
}

const cleanFolder = function (folderPath) {
    // delete files inside folder but not the folder itself
    del.sync([`${folderPath}/**`, `!${folderPath}`]);
};

cleanFolder(UPLOAD_PATH);

// TODO: DATABASE SAVING NOT WORKING
async function loadDBs(){
    colFunctions = await loadCollection(COLLECTION_FUNCTIONS, db);
    colRuntimes = await loadCollection(COLLECTION_FUNCTIONS, db);
    colCalls = await loadCollection(COLLECTION_CALLS, db);
} 

loadDBs().then(() => {
    logger.info('DBs loaded')
})
// GET FUNCTIONS

app.get('/functions', async function (req, res) {
    logger.info(`GET FUNCTIONS`);

    var solArr = colFunctions.where(function (obj) {
        return obj.functionName != '';
    });

    sol = [];

    for (i = 0; i < solArr.length; i++) {
        sol.push(solArr[i].functionName);
    }

    logger.debug(sol);

    res.send(sol);

    db.saveDatabase();
});


// GET RUNTIMES

app.get('/runtimes', async function (req, res) {
    logger.info(`GET RUNTIMES`);

    var solArr = colRuntimes.where(function (obj) {
        return obj.image != '';
    });

    sol = [];

    for (i = 0; i < solArr.length; i++) {
        sol.push(solArr[i].image);
    }

    logger.debug(sol);

    res.send(sol);

    db.saveDatabase();

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

        var already = colRuntimes.where(function (obj) {
            return obj.image == req.body.image
        });
        logger.debug(already.length);
        if (already.length > 0) {
            logger.debug(`already ${JSON.stringify(already)}`);
            logger.warn(`runtime already registered`);
            res.sendStatus(400);
            return;
        }
        const data = colRuntimes.insert(req.body);

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
        res.sendStatus(200);
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
        var exists = colRuntimes.where(function (obj) {
            return obj.image == req.file.runtimeName;
        });
        logger.debug(exists.length);
        if (exists.length != 1) {
            logger.warn(`Inexistent runtime`);

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            utils.executeSync(logger, commandline);
            res.sendStatus(400);
            return;
        }


        //check if function is registered.
        //TODO: Accept versions of the same function, maybe other API route
        var already = colFunctions.where(function (obj) {
            return obj.functionName == req.file.functionName;
        });
        logger.debug(already.length);
        if (already.length > 0) {
            logger.debug(`already ${JSON.stringify(already)}`);
            logger.warn(`Function name already registered`);

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            utils.executeSync(logger, commandline);

            res.sendStatus(400);
            return;
        }

        const data = colFunctions.insert(req.file);

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

        res.sendStatus(200);
        return;
    } catch (err) {
        logger.error(err);
        res.sendStatus(400);
    }

});


// POST INVOKEFUNCTION

app.post('/invokeFunction', async function (req, res) {

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
    var funcQuery = colFunctions.where(function (obj) {
        return obj.functionName == req.body.funcName;
    });
    logger.debug(funcQuery.length);
    if (funcQuery.length != 1) {
        logger.debug(`already ${JSON.stringify(funcQuery)}`);
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
    var insertedCall = colCalls.insert(req.body);


    var containerPath = runQuery[0].path;
    var runtimeRunCmd = runQuery[0].run;
    var runtimeDeps = runQuery[0].dependencies;
    logger.debug(`object runtime ${JSON.stringify(runQuery)}`);
    logger.debug(`container path ${containerPath}`);

    // save the parameters to a file

    // create the folder
    var commandline = `mkdir -p calls/${callNum}`;
    utils.executeSync(logger, commandline);

    // add an info file
    fileObject = {
        "runtime": runtime,
        "function": funcName
    };
    var commandline = `echo '${JSON.stringify(fileObject)}' > calls/${callNum}/info.json`
    utils.executeSync(logger, commandline);

    // create the params file
    var commandline = `echo '${JSON.stringify(params)}' > calls/${callNum}/input.json`
    utils.executeSync(logger, commandline);

    // launch the container volume-binding the uncompressed files. Leave the container idling 
    // (this should be done on the image I guess).


    // TODO: parametrize the hostpath

    await utils.createContainer(logger, runtime, registryIP, registryPort, callNum);

    // TODO: copy data
    // FIXME: Atm the containerName is just created. In the future a container will be fetched for each call.

    var containerName = `${callNum}-${runtime}`;
    await utils.copyFunction(logger, runtime, funcName, containerName, containerPath);

    // TODO: call the function on the runtime image. read the parameters and pass them to the func.

    await utils.startContainer(logger, containerName);

    // Install the dependencies

    await utils.runDockerCommand(logger, containerName, runtimeDeps);

    // pass the arguments to the running function

    await utils.copyInput(logger, containerName, containerPath, callNum);

    // exec the function

    await utils.runDockerCommand(logger, containerName, runtimeRunCmd);

    res.sendStatus(200);
});


// SERVER START

app.listen(port, () => logger.log('info', `FaaS listening at http://localhost:${port}`))

//----------------------------------------------------------------------------------//
// SIGNAL HANDLING

process.on('SIGINT', function () {
    logger.info('Received SIGTERM');

    db.saveDatabase();

    process.exit();

});