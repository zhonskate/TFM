const {
    execSync
} = require('child_process');

async function createContainer(logger, runtime, funcName, containerPath, registryIP, registryPort, callNum) {

    logger.verbose(`CREATE CONTAINER ${runtime} ${funcName}`);

    var commandline = `docker create \
        --name ${callNum}-${runtime} \
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

}

async function executeSync(logger, commandline) {

    logger.verbose(`EXECUTE SYNC ${commandline}`);

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
}

//FIXME: no va

async function validName(logger, name) {

    logger.verbose(`TESTING REGEX VALIDNAME ${name}`);
    var reg = /[!@#$%^&*(),.?":{}|<>-_//]/
    logger.debug(`REG RESULT ${reg.test(name)}`);
    return !reg.test(name);
}

module.exports = {
    createContainer,
    executeSync,
    validName
};