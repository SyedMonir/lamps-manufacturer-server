// Require
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectID } = require('bson');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DV_PASS}@cluster0.pqjmp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const partCollection = client.db('partCollection').collection('parts');
    const userCollection = client.db('partCollection').collection('users');

    // All Parts API
    app.get('/parts', async (req, res) => {
      const parts = await partCollection.find().toArray();
      res.send(parts);
    });

    // Part API
    app.get('/parts/:partID', async (req, res) => {
      const id = req.params.partID;
      console.log(id);
      const part = await partCollection.findOne({ _id: ObjectID(id) });
      res.send(part);
    });

    // User PUT
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });
  } finally {
    console.log('Connection closed from run');
  }
}

run().catch(console.dir);

// Root API
app.get('/', (req, res) => {
  res.send('Lamps Manufacturer Server Started');
});

// Port
app.listen(port, () => {
  console.log(`Lamps Manufacturer Server Started ${port}`);
});
