const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ui1n29x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("petsDB");
        const userCollection = database.collection("users");


        // users related api

        // get all users from database
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // set admin role
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const setRole = req.body;
            const updatedDoc = {
                $set: {
                    role: setRole.role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // a user save to database
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user does not exists
            // you can do this many ways (1. email , 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existing = await userCollection.findOne(query);
            if (existing) {
                return res.send({ message: 'User already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('My last assignment project')
});

app.listen(port, () => {
    console.log(`My last assignment project on port: ${port}`)
});