// Require
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Verify Token
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers.authorization;
  if (!bearerHeader) {
    return res.status(401).send('Unauthorized');
  }
  const token = bearerHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send('Forbidden');
    }
    req.decoded = decoded;
  });
  next();
};

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
    const purchaseCollection = client
      .db('partCollection')
      .collection('purchases');

    // All Parts API
    app.get('/parts', async (req, res) => {
      const parts = await partCollection.find().toArray();
      res.send(parts);
    });

    // Part API
    app.get('/parts/:partID', async (req, res) => {
      const id = req.params.partID;
      const part = await partCollection.findOne({ _id: ObjectId(id) });
      res.send(part);
    });

    // Part Update API
    // app.put('/parts/:partID', async (req, res) => {
    //   const id = req.params.partID;
    //   const part = req.body;
    //   await partCollection.updateOne(
    //     { _id: ObjectId(id) },
    //     {
    //       $set: {
    //         quantity: part.updatedQuantity,
    //       },
    //     }
    //   );
    //   res.send(part);
    // });

    // User PUT API
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: 3600,
        }
      );
      res.send({ result, token });
    });

    // User GET API
    // app.get('/user/:email', async (req, res) => {
    //   const email = req.params.email;
    //   const user = await userCollection.findOne({ email: email });
    //   console.log({ user });
    //   res.send({ user });
    // });

    // Purchase Post API
    app.post('/purchase', async (req, res) => {
      const purchase = req.body;
      const result = await purchaseCollection.insertOne(purchase);
      res.send(result);
    });

    // Purchase GET API
    app.get('/purchase/:email', async (req, res) => {
      const email = req.params.email;
      const purchases = await purchaseCollection
        .find({ email: email })
        .toArray();
      // console.log(purchases);
      res.send(purchases);
    });

    // Purchase One Get API
    app.get('/purchase/:email/:partID', async (req, res) => {
      const partID = req.params.partID;
      const purchase = await purchaseCollection.findOne({
        _id: ObjectId(partID),
      });
      res.send(purchase);
    });

    // Purchase Delete API
    app.delete('/purchase/:id', async (req, res) => {
      const query = { _id: ObjectId(req.params.id) };
      const result = await purchaseCollection.deleteOne(query);
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
