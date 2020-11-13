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

    logger.debug(`PRELOAD NOTHING`);

    // launch the container volume-binding the uncompressed files. Leave the container idling 
    // (this should be done on the image I guess).

    var containerName = `${callNum}-${runtime}`;

    await utils.runContainer(logger, runtime, registryIP, registryPort, containerName);

    var timing = new Date().getTime();
    callObject.insertedCall.timing.runtime = timing;

    await utils.copyFunction(logger, runtime, funcName, containerName, containerPath);

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

    logger.debug(`RESULT ${result.output}`);

    insertedCall.status = 'DONE';
    insertedCall.result = result.output;

    return insertedCall;

}

async function forceDelete(logger, containerName, warmContent) {

    await utils.forceDeleteContainer(logger, containerName);
}

async function preloadRuntime(logger, callObject) {

    let runtime = callObject.runtime;
    let registryIP = callObject.registryIP;
    let registryPort = callObject.registryPort;
    let containerName = callObject.containerName;

    logger.debug(`PRELOAD RUNTIME`);

    // launch the container volume-binding the uncompressed files. Leave the container idling 
    // (this should be done on the image I guess).

    await utils.runContainer(logger, runtime, registryIP, registryPort, containerName);

}

async function execRuntimePreloaded(logger, callObject, CALLS_PATH) {

    let runtime = callObject.runtime;
    let callNum = callObject.callNum;
    let funcName = callObject.funcName;
    let containerPath = callObject.containerPath;
    let runtimeDeps = callObject.runtimeDeps;
    let runtimeRunCmd = callObject.runtimeRunCmd;
    let insertedCall = callObject.insertedCall;
    let containerName = callObject.containerName;

    logger.debug(`EXEC RUNTIME PRELOADED`);

    await utils.copyFunction(logger, runtime, funcName, containerName, containerPath);

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

    logger.debug(`RESULT ${result.output}`);

    insertedCall.status = 'DONE';
    insertedCall.result = result.output;

    return insertedCall;

}

async function preloadFunction(logger, callObject) {

    let runtime = callObject.runtime;
    let registryIP = callObject.registryIP;
    let registryPort = callObject.registryPort;
    let containerName = callObject.containerName;
    let containerPath = callObject.containerPath;
    let runtimeDeps = callObject.runtimeDeps;
    let funcName = callObject.funcName;

    logger.debug(`PRELOAD FUNCTION`);

    // launch the container volume-binding the uncompressed files. Leave the container idling 
    // (this should be done on the image I guess).

    await utils.runContainer(logger, runtime, registryIP, registryPort, containerName);

    await utils.copyFunction(logger, runtime, funcName, containerName, containerPath);

    // Install the dependencies

    await utils.runDockerCommand(logger, containerName, runtimeDeps);

}

async function execFunctionPreloaded(logger, callObject, CALLS_PATH) {

    let callNum = callObject.callNum;
    let containerPath = callObject.containerPath;
    let runtimeRunCmd = callObject.runtimeRunCmd;
    let insertedCall = callObject.insertedCall;
    let containerName = callObject.containerName;

    logger.debug(`EXEC FUNCTION PRELOADED`);

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

    logger.debug(`RESULT ${result.output}`);

    insertedCall.status = 'DONE';
    insertedCall.result = result.output;

    return insertedCall;

}


// Exports
//----------------------------------------------------------------------------------//

module.exports = {
    preloadNothing,
    preloadRuntime,
    execRuntimePreloaded,
    forceDelete,
    preloadFunction,
    execFunctionPreloaded
};