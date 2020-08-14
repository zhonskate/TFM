const express = require('express')
const bodyParser = require('body-parser')
const logger = require('winston');

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

logger.log('silly', '6: silly');
logger.log('debug', '5: debug');
logger.log('verbose', '4: verbose');
logger.log('http', '3: http');
logger.log('info', '2: info');
logger.log('warn', '1: warn');
logger.log('error', '0: error');

var registryIP = 'localhost';
var registryPort = '5000';

const app = express()
const port = 3000

app.use(bodyParser.json())

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
    logger.log('debug',commandline);
    exec(commandline, function(error, stdout, stderr) {

        if (stderr){
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
        logger.log('debug',commandline);
        exec(commandline, function(error, stdout, stderr) {

            if (stderr){
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

app.post('/registerFunction', (req, res) => res)

app.post('/invokeFuction', (req, res) => res)

app.listen(port, () => logger.log('info', `FaaS listening at http://localhost:${port}`))