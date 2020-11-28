const fs = require('fs')

var fileName = process.argv[2];

console.log(fileName);

var lowerRange = process.argv[3] | 1;

console.log(`lower range ${lowerRange}`);

var upperRange = process.argv[4] | -1;

console.log(`upper range ${upperRange}`);

fs.readFile(fileName, 'utf8', (err, file) => {

    //console.log('File data:', file);

    oriname = fileName.split('/')[2].split('.')[0];
    
    file = JSON.parse(file);

    var numCalls = Object.keys(file).length;

    console.log(numCalls);

    var logger = fs.createWriteStream(`../input/f-${oriname}.txt`);

    logger.write(`callNum\tworker\tqueue\truntime\tfunction\tresult\n`);

    for(var i = lowerRange; i != upperRange + 1 && i < numCalls + 1; i++){

        if(file['c'+i].timing.queue == null){file['c'+i].timing.queue = 0;}
        if(file['c'+i].timing.runtime == null){file['c'+i].timing.runtime = file['c'+i].timing.function;}

        logger.write(`${file['c'+i].callNum}\t\
${file['c'+i].timing.worker}\t\
${file['c'+i].timing.queue}\t\
${file['c'+i].timing.runtime}\t\
${file['c'+i].timing.function}\t\
${file['c'+i].timing.result}\n`);
    }

    logger.close();

});