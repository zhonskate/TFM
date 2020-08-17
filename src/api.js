// LIBRARIES

const express = require('express')
const bodyParser = require('body-parser')
const logger = require('winston');
var multer = require('multer');
var cors = require('cors');
var Loki = require('lokijs');
var del = require('del');

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
const COLLECTION_NAME = 'functions';
const UPLOAD_PATH = 'uploads';
const upload = multer({ dest: `${UPLOAD_PATH}/` }); // multer configuration
const db = new Loki(`${UPLOAD_PATH}/${DB_NAME}`, { persistenceMethod: 'fs' });

// EXPRESS CONF

const app = express()
app.use(cors());
app.use(bodyParser.json())

// OTHER DECLARATIONS

const port = 3000
var registryIP = 'localhost';
var registryPort = '5000';

//----------------------------------------------------------------------------------//
// Upload-related code

const loadCollection = function (colName, db){
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

app.post('/registerRuntime', function (req, res) {

    // {image:<imageName>}

    logger.log('debug', JSON.stringify(req.body));
    logger.log('debug', req.body.image);
    img = req.body.image;

    var exec = require('child_process').exec;

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

app.post('/registerFunction',upload.single('module'), async(req, res, next) =>{

    // receive from http
    try {
        // add to database /uploads
        logger.debug(JSON.stringify(req.file))
        const col = await loadCollection(COLLECTION_NAME, db);
        const data = col.insert(req.file);
        db.saveDatabase();

        // TODO: Create a new folder for each function and uncompress it to bind it later.
        // TODO: add the function name to the DB. Assign it to a Runtime. 

        // create the sha of the tgz
        // var tarfile = fs.readFileSync(req.file.path, 'utf8');
        // var hash = sha256(tarfile);


        // prepare folder to build the image
        /* fs.rename(req.file.path,'./build/module.tar.gz',function(error, stdout, stderr){
            if(error){console.log(error);}
            if(stderr){console.log(stderr);}
            if(stdout){console.log(stdout);}
        }) */
    } 
    catch (err) {
        logger.error(err);
        res.sendStatus(400);
    }

});

app.post('/invokeFuction', (req, res) => res)

app.listen(port, () => logger.log('info', `FaaS listening at http://localhost:${port}`))