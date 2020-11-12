// Libraries
//----------------------------------------------------------------------------------//

const {
    execSync,
    exec
} = require('child_process');


// Functions
//----------------------------------------------------------------------------------//

function execute(logger, cmd) {

    logger.debug(`EXECUTE ${cmd}`);

    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (stderr) {
                if(stderr.toLocaleLowerCase().includes('warning')){
                    logger.warn(stderr);
                }
                else{
                    logger.log('error', stderr);
                }
            }

            if (error !== null) {
                logger.log('error', error);
                return new Error([error]);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

async function executeSync(logger, commandline) {

    logger.debug(`EXECUTE SYNC ${commandline}`);

    execSync(commandline, function (error, stdout, stderr) {

        if (stderr) {
            if(stderr.toLocaleLowerCase().includes('warning')){
                logger.warn(stderr);
            }
            else{
                logger.log('error', stderr);
            }
        }

        if (error !== null) {
            logger.log('error', error);
            return new Error([error]);
        }
    });
}

async function createContainer(logger, runtime, registryIP, registryPort, callNum) {

    logger.debug(`CREATE CONTAINER ${runtime}`);

    var commandline = `docker create \
        --name ${callNum}-${runtime} \
        -t \
        ${registryIP}:${registryPort}/${runtime}`

    await execute(logger, commandline);
}

async function runContainer(logger, runtime, registryIP, registryPort, containerName) {

    logger.debug(`RUN CONTAINER ${runtime}`);

    var commandline = `docker run -d \
        --name ${containerName} \
        -t \
        ${registryIP}:${registryPort}/${runtime}`

    await execute(logger, commandline);
}

async function copyFunction(logger, runtime, funcName, containerName, containerPath) {

    logger.verbose(`COPY DATA ${runtime} ${funcName}`);

    var commandline = `docker cp \
        ${__dirname}/uploads/${runtime}/${funcName}/. \
        ${containerName}:${containerPath}`

    await execute(logger, commandline);
}

async function startContainer(logger, containerName) {

    logger.debug(`START CONTAINER ${containerName}`);

    var commandline = `docker start ${containerName}`;

    await execute(logger, commandline);
}

async function copyInput(logger, containerName, containerPath, callNum) {

    logger.debug(`COPY INPUT ${containerName}`)

    var commandline = `docker cp \
        ${__dirname}/calls/${callNum}/input.json \
        ${containerName}:${containerPath}`

    await execute(logger, commandline);
}

async function fetchOutput(logger, containerName, containerPath, callNum) {

    logger.debug(`FETCH OUTPUT ${containerName}`)

    var commandline = `docker cp \
        ${containerName}:${containerPath}/output.json \
        ${__dirname}/calls/${callNum}`

    await execute(logger, commandline);
}

function stopContainer(logger, containerName) {
    logger.verbose(`STOP CONTAINER ${containerName}`)

    var commandline = `docker stop \
        ${containerName}`

    execute(logger, commandline);
}

function deleteContainer(logger, containerName) {
    logger.debug(`DELETE CONTAINER ${containerName}`)

    var commandline = `docker rm \
        ${containerName}`

    execute(logger, commandline);
}

function forceDeleteContainer(logger, containerName) {
    logger.debug(`DELETE CONTAINER ${containerName}`)

    var commandline = `docker rm -f \
        ${containerName}`

    execute(logger, commandline);
}

async function runDockerCommand(logger, containerName, command) {

    logger.debug(`COPY INPUT ${containerName}`)

    var commandline = `docker exec \
        ${containerName} \
        ${command}`

    await execute(logger, commandline);
}

function validName(logger, name) {

    logger.debug(`TESTING REGEX VALIDNAME ${name}`);
    var reg = /[!@#$%^&*(),.?":{}|<>\-_/]/
    logger.debug(`REG RESULT ${reg.test(name)}`);
    return !reg.test(name);
}


// Exports
//----------------------------------------------------------------------------------//

module.exports = {
    createContainer,
    runContainer,
    executeSync,
    copyFunction,
    startContainer,
    copyInput,
    fetchOutput,
    stopContainer,
    deleteContainer,
    forceDeleteContainer,
    runDockerCommand,
    validName
};