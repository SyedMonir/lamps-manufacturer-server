// Require
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Verify Token
const verifyJWT = (req, res, next) => {
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
    const reviewCollection = client.db('partCollection').collection('reviews');
    const paymentCollection = client
      .db('partCollection')
      .collection('payments');
    const purchaseCollection = client
      .db('partCollection')
      .collection('purchases');

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const requestedUser = req?.decoded?.email;
      // console.log(requestedUser);
      const isAdmin = await userCollection.findOne({ email: requestedUser });
      // console.log(isAdmin);
      if (isAdmin?.role === 'admin') {
        next();
      } else {
        return res.status(403).send('Forbidden');
      }
    };

    // Payment
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

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

    // Delete Part API
    app.delete('/parts/:partID', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.partID;
      const result = await partCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // Create Part API
    app.post('/parts', verifyJWT, verifyAdmin, async (req, res) => {
      // console.log(req.body);
      const { name, description, price, image, quantity } = req.body;
      const newPart = {
        name,
        description,
        price,
        image,
        quantity,
      };
      const result = await partCollection.insertOne(newPart);
      res.send(result);
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
          expiresIn: '1d',
        }
      );
      res.send({ result, token });
    });

    // User GET API
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      // console.log({ user });
      res.send({ user });
    });

    // User All Get API
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // Make Admin
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      // console.log(filter);
      const updateDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      // console.log(result);
      res.send(result);
    });

    // Get  Admins
    app.get('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === 'admin';
      // console.log(isAdmin);
      res.send({ admin: isAdmin });
    });

    // Purchase Post API
    app.post('/purchase', verifyJWT, async (req, res) => {
      const purchase = req.body;
      const result = await purchaseCollection.insertOne(purchase);
      res.send(result);
    });

    // Purchase Get All API
    app.get('/purchase', verifyJWT, verifyAdmin, async (req, res) => {
      const purchases = await purchaseCollection.find().toArray();
      // console.log(purchases);
      res.send(purchases);
    });

    // Purchase GET API
    app.get('/purchase/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const purchases = await purchaseCollection
        .find({ email: email })
        .toArray();
      // console.log(purchases);
      res.send(purchases);
    });

    // Purchase One Get API
    app.get('/purchase/:email/:partID', verifyJWT, async (req, res) => {
      const partID = req.params.partID;
      const purchase = await purchaseCollection.findOne({
        _id: ObjectId(partID),
      });
      res.send(purchase);
    });

    // Purchase Update API
    app.patch('/purchase/:email/:partID', verifyJWT, async (req, res) => {
      const partID = req.params.partID;
      const purchase = req.body;
      // console.log(purchase);
      const filter = { _id: ObjectId(partID) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: purchase.transitionId,
        },
      };
      const result = await paymentCollection.insertOne(purchase);
      const updateBooking = await purchaseCollection.updateOne(
        filter,
        updateDoc
      );
      // console.log(result, updateBooking);
      res.send(updateBooking);
    });

    // Purchase Shipped API
    app.patch(
      '/purchase/shipped/:email/:partID',
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const partID = req.params.partID;
        console.log(partID);
        const filter = { _id: ObjectId(partID) };
        const updateDoc = {
          $set: {
            isShipped: true,
          },
        };
        const result = await purchaseCollection.updateOne(filter, updateDoc);
        console.log(result);
        res.send(result);
      }
    );

    // Purchase Delete API
    app.delete('/purchase/:id', verifyJWT, async (req, res) => {
      const query = { _id: ObjectId(req.params.id) };
      const result = await purchaseCollection.deleteOne(query);
      res.send(result);
    });

    // Review Post API
    app.post('/review', verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // Review GET ALL API
    app.get('/review', async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.send(reviews);
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
