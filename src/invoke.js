// Libraries
//----------------------------------------------------------------------------------//

var utils = require('./utils');
const fs = require('fs');


// Functions
//----------------------------------------------------------------------------------//

async function preloadNothing(logger, callObject, CALLS_PATH) {

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

    await utils.createContainer(logger, runtime, registryIP, registryPort, callNum);

    // TODO: copy data
    // FIXME: Atm the containerName is just created. In the future a container will be fetched for each call.

    var timing = new Date().getTime();
    callObject.insertedCall.timing.runtime = timing;

    await utils.copyFunction(logger, runtime, funcName, containerName, containerPath);

    // TODO: call the function on the runtime image. read the parameters and pass them to the func.

    await utils.startContainer(logger, containerName);


    // Install the dependencies

    await utils.runDockerCommand(logger, containerName, runtimeDeps);

    timing = new Date().getTime();
    callObject.insertedCall.timing.function = timing;

    // pass the arguments to the running function

    await utils.copyInput(logger, containerName, containerPath, callNum);

    // exec the function

    await utils.runDockerCommand(logger, containerName, runtimeRunCmd);

    // fetch the output

    await utils.fetchOutput(logger, containerName, containerPath, callNum);

    utils.forceDeleteContainer(logger, containerName);

    // add output to DB
    let rawdata = fs.readFileSync(`${__dirname}/${CALLS_PATH}/${callNum}/output.json`);
    let result = JSON.parse(rawdata);

    logger.verbose(`RESULT ${result.output}`);

    insertedCall.status = 'DONE';
    insertedCall.result = result.output;

    return insertedCall;

}

async function preloadRuntime() {

}

async function preloadFunction() {

}


// Exports
//----------------------------------------------------------------------------------//

module.exports = {
    preloadNothing,
    preloadRuntime,
    preloadFunction
};