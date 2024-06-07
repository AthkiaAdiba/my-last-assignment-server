const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        const petCollection = database.collection("pets");
        const adoptionCollection = database.collection("adoptions");
        const campaignCollection = database.collection("campaigns");
        const donationCollection = database.collection("donations");


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token });
        });

        // middleware
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verify Token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        // pet related apis

        // get pets from database user wise
        app.get('/pets/:email', verifyToken, async (req, res) => {

            if (req.decoded.email !== req.params.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const result = await petCollection.find({ email: req.params.email }).toArray();

            res.send(result)
        });

        // get all pets by admin
        app.get('/allPets', async(req, res) => {
            const result = await petCollection.find().toArray();
            res.send(result);
        })

        // get single pet id wise
        app.get('/pet/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await petCollection.findOne(query);
            res.send(result);
        });

        // get all pets which are not adopted for pet listing page
        app.get('/pets-unadopted', async (req, res) => {
            const result = await petCollection.find({ adopted: false }).sort({ "date": -1 }).toArray();
            res.send(result)
        });

        // save a pet to the database
        app.post('/pets', verifyToken, async (req, res) => {
            const pet = req.body;
            const result = await petCollection.insertOne(pet);
            res.send(result);
        });

        // update a pet in the database
        app.patch('/updatePet/:id', async (req, res) => {
            const id = req.params.id;
            const pet = req.body;
            const filter = { _id: new ObjectId(id) }
            console.log(pet)
            const updatedDoc = {
                $set: {
                    pet_name: pet.pet_name,
                    pet_category: pet.pet_category,
                    pet_image: pet.pet_image,
                    pet_age: pet.pet_age,
                    pet_location: pet.pet_location,
                    short_description: pet.short_description,
                    long_description: pet.long_description,
                    date: pet.date
                }
            }
            const result = await petCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // change adopted status
        app.patch('/pets/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const setAdopted = req.body;
            const updatedDoc = {
                $set: {

                    adopted: setAdopted.adopted
                }
            }
            const result = await petCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // Delete a pet from the pet collection
        app.delete('/deletePet/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await petCollection.deleteOne(query)
            res.send(result);
        });



        // adoption related api

        // get adoption requests by created pet user email 
        app.get('/adoptionRequests/:email', async(req, res) => {
            const email = req.params.email;
            const query = {owner_email: email}
            const result = await adoptionCollection.find(query).toArray()
            res.send(result);
        })

        // save adoption in the adoption collection to the database
        app.post('/addAdoption', verifyToken, async(req, res) => {
            const adoptionPet = req.body;
            const result = await adoptionCollection.insertOne(adoptionPet)
            res.send(result)
        })

        // set accepting status
        app.patch('/statusAccept/:id', async(req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            
            const updatedDoc = {
                $set: {
                    status: 'Accepted'
                }
            }
            const result = await adoptionCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        
        
        // set rejecting status
        app.patch('/statusReject/:id', async(req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            
            const updatedDoc = {
                $set: {
                    status: 'Rejected'
                }
            }
            const result = await adoptionCollection.updateOne(filter, updatedDoc)
            res.send(result)
        });
        
        

        // campaigns related apis

        // get all campaign data from database
        app.get('/campaignCards', async(req, res) => {
            const result = await campaignCollection.find().sort({"create_date": -1}).toArray();
            res.send(result)
        })

        // get campaign details id wise
        app.get('/campaignCards/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campaignCollection.findOne(query)
            res.send(result);
        })
        
        // save a campaign to the database
        app.post('/campaign', async(req, res) => {
            const campaign = req.body;
            const result = await campaignCollection.insertOne(campaign);
            res.send(result)
        })


        // users related api

        // get all users from database
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // get admin role
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role == 'admin';
            }
            res.send({ admin })

        })

        // set admin role
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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


        // payment intent
        app.post('/create-payment-intent', async(req, res) => {
            const {donation} = req.body;
            if(donation <= 0){
                return res.send({error: 'Invalid Donation'})
            }
            const donationAmount = parseInt(donation * 100);
            console.log('in the intent', donationAmount)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: donationAmount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


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