import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3000

let storedData = {}

app.use(cors())
app.use(express.json())
app.use(express.static('public'))

app.post('/', (req, res) => {
  console.log('Received data:', JSON.stringify(req.body, null, 2))
  storedData = req.body
  res.json({ message: 'Data received successfully!' })
})

app.get('/data', (req, res) => {
  res.json(storedData)
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
