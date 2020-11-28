const fs = require('fs')

fs.readFile('./input.json', 'utf8', (err, file) => {

    console.log('File data:', file);

    const out = {
        'output':'world'
    }

    fs.writeFile('./output.json', JSON.stringify(out), err => {
        if (err) {
            console.log('Error writing file', err)
        } else {
            console.log('Successfully wrote file')
        }
    })
});