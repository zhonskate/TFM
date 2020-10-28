const fs = require('fs');
var Dice = require('node-dice-js');

fs.readFile('./input.json', 'utf8', (err, file) => {

    console.log('File data:', file);

    var roll = JSON.parse(file).roll; 
    var dic = new Dice();
    var res = dic.execute(roll);

    const out = {
        'output':res.outcomes[0].rolls
    }

    fs.writeFile('./output.json', JSON.stringify(out), err => {
        if (err) {
            console.log('Error writing file', err)
        } else {
            console.log('Successfully wrote file')
        }
    })
});