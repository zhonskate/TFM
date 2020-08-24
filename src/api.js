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
var callNum = 0;

//----------------------------------------------------------------------------------//
// Upload-related code

const loadCollection = function (colName, db) {
    return new Promise(resolve => {
        db.loadDatabase({}, () => {
            const _collection = db.getCollection(colName) || db.addCollection(colName);
            resolve(_collection);
        })
    });
}

const cleanFolder = function (folderPath) {
    // delete files inside folder but not the folder itself
    del.sync([`${folderPath}/**`, `!${folderPath}`]);
};

cleanFolder(UPLOAD_PATH);


app.get('/test', (req, res) => res.send('Hello World!'))

//TODO: esto 

app.get('/functions', async function (req, res) {
    logger.info(`GET FUNCTIONS`);

    const col = await loadCollection(COLLECTION_FUNCTIONS, db);
    var solArr = col.where(function (obj) {
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

app.get('/runtimes', async function (req, res) {
    logger.info(`GET RUNTIMES`);

    const col = await loadCollection(COLLECTION_RUNTIMES, db);
    var solArr = col.where(function (obj) {
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

app.post('/registerRuntime', async function (req, res) {

    logger.info(`REGISTER RUNTIME ${req.body.image}`);

    //TODO: Asignar una ruta para la descompresión de archivos de función.

    // {image:<imageName>, path: <path>}

    logger.log('debug', JSON.stringify(req.body));
    logger.log('debug', req.body.image);
    logger.debug(req.body.path);
    img = req.body.image;
    path = req.body.path;

    if (img == undefined || path == undefined) {
        logger.warn('USAGE image:<imageName>, path: <path>');
        res.sendStatus(400);
        return;
    }

    var exec = require('child_process').exec;

    const col = await loadCollection(COLLECTION_RUNTIMES, db);
    var already = col.where(function (obj) {
        return obj.image == req.body.image
    });
    logger.debug(already.length);
    if (already.length > 0) {
        logger.debug(`already ${JSON.stringify(already)}`);
        logger.warn(`runtime already registered`);
        res.sendStatus(400);
        return;
    }
    const data = col.insert(req.body);
    db.saveDatabase();


    // tag image
    var commandline = `\
    docker \
    tag \
    ${img} ${registryIP}:${registryPort}/${img}`
    logger.log('debug', commandline);
    exec(commandline, function (error, stdout, stderr) {

        if (stderr) {
            logger.log('error', stderr);
        }

        if (error !== null) {
            logger.log('error', error);
            res.send(error);
            return next(new Error([error]));
        }

        // push the image to the registry
        var commandline = `\
        docker \
        push \
        ${registryIP}:${registryPort}/${img}`
        logger.log('debug', commandline);
        exec(commandline, function (error, stdout, stderr) {

            if (stderr) {
                logger.log('error', stderr);
            }

            if (error !== null) {
                logger.log('error', error);
                res.send(error);
                return next(new Error([error]));
            }

            logger.info(`image ${img} uploaded to registry`);
            // return the status
            res.sendStatus(200);

        });
    });
})

app.post('/registerFunction/:runtimeName/:functionName', upload.single('module'), async (req, res, next) => {

    logger.info(`REGISTER FUNCTION ${req.params.functionName} OF RUNTIME ${req.params.runtimeName}`);

    // TODO: assign function to runtime

    var exec = require('child_process').exec;

    // receive from http
    try {
        req.file.functionName = req.params.functionName;
        req.file.runtimeName = req.params.runtimeName;
        logger.debug(JSON.stringify(req.file))

        //check if runtime exists
        const runCol = await loadCollection(COLLECTION_RUNTIMES, db);
        var exists = runCol.where(function (obj) {
            return obj.image == req.file.runtimeName;
        });
        logger.debug(exists.length);
        if (exists.length != 1) {
            logger.warn(`Inexistent runtime`);

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            execSync(commandline, function (error, stdout, stderr) {
                if (stderr) {
                    logger.log('error', stderr);
                }
                if (error !== null) {
                    logger.log('error', error);
                    res.send(error);
                    return next(new Error([error]));
                }
            });
            res.sendStatus(400);
            return;
        }


        //check if function is registered.
        //TODO: Accept versions of the same function, maybe other API route
        const col = await loadCollection(COLLECTION_FUNCTIONS, db);
        var already = col.where(function (obj) {
            return obj.functionName == req.file.functionName;
        });
        logger.debug(already.length);
        if (already.length > 0) {
            logger.debug(`already ${JSON.stringify(already)}`);
            logger.warn(`Function name already registered`);

            //remove the incoming file.
            var commandline = `rm uploads/${req.file.filename}`;
            execSync(commandline, function (error, stdout, stderr) {
                if (stderr) {
                    logger.log('error', stderr);
                }
                if (error !== null) {
                    logger.log('error', error);
                    res.send(error);
                    return next(new Error([error]));
                }
            });
            res.sendStatus(400);
            return;
        }

        const data = col.insert(req.file);
        db.saveDatabase();

        var folderName = req.file.runtimeName + '/' + req.file.functionName;
        logger.debug(`function Name ${folderName}`)

        // Create a folder to hold the function contents
        var commandline = `mkdir -p uploads/${folderName}`
        execSync(commandline, function (error, stdout, stderr) {
            if (stderr) {
                logger.log('error', stderr);
            }
            if (error !== null) {
                logger.log('error', error);
                res.send(error);
                return next(new Error([error]));
            }
        });

        // extract the file on the newly created folder
        var commandline = `tar -C uploads/${folderName} -zxf uploads/${req.file.filename}`
        execSync(commandline, function (error, stdout, stderr) {
            if (stderr) {
                logger.log('error', stderr);
            }
            if (error !== null) {
                logger.log('error', error);
                res.send(error);
                return next(new Error([error]));
            }
        });


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

app.post('/invokeFunction', async function (req, res) {

    var exec = require('child_process').exec;

    var funcName = req.body.funcName;
    var params = req.body.params;

    logger.info(`INVOKING ${funcName} WITH PARAMS ${JSON.stringify(params)}`);

    // check arguments are present
    if (funcName == undefined || params == undefined) {
        logger.warn('INCORRECT ARGUMENTS')
        res.sendStatus(400);
    }

    // check if function exists
    const col = await loadCollection(COLLECTION_FUNCTIONS, db);
    var funcQuery = col.where(function (obj) {
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

    // look for the runtime path
    const runCol = await loadCollection(COLLECTION_RUNTIMES, db);
    var runQuery = runCol.where(function (obj) {
        return obj.image == runtime;
    });

    var containerPath = runQuery[0].path;
    logger.debug(`object runtime ${JSON.stringify(runQuery)}`);
    logger.debug(`container path ${containerPath}`);

    // save the parameters to a file

    // create the folder
    var commandline = `mkdir -p calls/${callNum}`;
    execSync(commandline, function (error, stdout, stderr) {
        if (stderr) {
            logger.log('error', stderr);
        }
        if (error !== null) {
            logger.log('error', error);
            res.send(error);
            return next(new Error([error]));
        }
    });

    // add an info file
    fileObject = {
        "runtime": runtime,
        "function": funcName
    };
    var commandline = `echo '${JSON.stringify(fileObject)}' > calls/${callNum}/info.json`
    execSync(commandline, function (error, stdout, stderr) {
        if (stderr) {
            logger.log('error', stderr);
        }
        if (error !== null) {
            logger.log('error', error);
            res.send(error);
            return next(new Error([error]));
        }
    });

    // create the params file
    var commandline = `echo '${JSON.stringify(params)}' > calls/${callNum}/input.json`
    execSync(commandline, function (error, stdout, stderr) {
        if (stderr) {
            logger.log('error', stderr);
        }
        if (error !== null) {
            logger.log('error', error);
            res.send(error);
            return next(new Error([error]));
        }
    });

    // launch the container volume-binding the uncompressed files

    // TODO: parametrize the hostpath

    var commandline = `docker run \
        -d \
        -v ${__dirname}/uploads/${runtime}/${funcName}:${containerPath} \
        -v ${__dirname}/calls/${callNum}:/call \
        ${registryIP}:${registryPort}/${runtime}`

    logger.debug(commandline);

    execSync(commandline, function (error, stdout, stderr) {
        if (stderr) {
            logger.log('error', stderr);
        }
        if (error !== null) {
            logger.log('error', error);
            res.send(error);
            return next(new Error([error]));
        }
    });

    // TODO: call the function on the runtime image. read the parameters and pass them to the func.

    // pass the arguments to the running function

    res.sendStatus(200);
});

app.listen(port, () => logger.log('info', `FaaS listening at http://localhost:${port}`))