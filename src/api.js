const express = require('express')
const app = express()
const port = 3000

app.get('/test', (req, res) => res.send('Hello World!'))

app.post('/function', (req,res) => res)

app.listen(port, () => console.log(`FaaS listening at http://localhost:${port}`))