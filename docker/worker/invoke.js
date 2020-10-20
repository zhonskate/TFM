var utils = require('./utils');
const fs = require('fs');

function preloadNothing(logger, callObject, CALLS_PATH) {

    let runtime = callObject.runtime;
    let registryIP = callObject.registry.split(':')[0];    
    let registryPort = callObject.registry.split(':')[1];    
    let callNum = callObject.callNum;
    let funcName = callObject.funcName;
    let containerPath = callObject.containerPath;
    let runtimeDeps = callObject.runtimeDeps;
    let runtimeRunCmd = callObject.runtimeRunCmd;
    let insertedCall = callObject.insertedCall;

    logger.info(`PRELOAD NOTHING`);

    // launch the container volume-binding the uncompressed files. Leave the container idling 
    // (this should be done on the image I guess).

    // TODO: Asyncronyze. 
    // FIXME pues no va mi pana. A ver que hacemos para hacerlo async

    // TODO: parametrize the hostpath

    var containerName = `${callNum}-${runtime}`;

    return utils.createContainer(logger, runtime, registryIP, registryPort, callNum)
    .then(() => {

        // TODO: copy data
        // FIXME: Atm the containerName is just created. In the future a container will be fetched for each call.

        utils.copyFunction(logger, runtime, funcName, containerName, containerPath);
        
    }).then(() => {

        // TODO: call the function on the runtime image. read the parameters and pass them to the func.

        utils.startContainer(logger, containerName);

    }).then(() => {

        // Install the dependencies

        utils.runDockerCommand(logger, containerName, runtimeDeps);

        // pass the arguments to the running function

        utils.copyInput(logger, containerName, containerPath, callNum);

    }).then(() => {

        // exec the function

        utils.runDockerCommand(logger, containerName, runtimeRunCmd);

    }).then(() => {

        // fetch the output

        utils.fetchOutput(logger, containerName, containerPath, callNum);

    }).then(() => {

        utils.forceDeleteContainer(logger, containerName);

        // add output to DB
        let rawdata = fs.readFileSync(`${__dirname}/${CALLS_PATH}/${callNum}/output.json`);
        let result = JSON.parse(rawdata);

        logger.verbose(`RESULT ${result.output}`);

        insertedCall.status = 'DONE';
        insertedCall.result = result.output;

        return insertedCall;

    });

}

async function preloadRuntime() {

}

async function preloadFunction() {

}

module.exports = {
    preloadNothing,
    preloadRuntime,
    preloadFunction
};