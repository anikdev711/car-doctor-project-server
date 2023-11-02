
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middleware

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://car-doctor-9aad5.web.app',
        'https://car-doctor-9aad5.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c6zpwyz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


//middleware created

const logger = async (req, res, next) => {
    console.log('called:', req.host, req.originalUrl);
    console.log('log: info', req.method, req.url);
    next();
}

//verify token middleware created
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('Value of token in middleware', token);
    if (!token) {
        return res.status(401).send({ message: 'not authorized' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        //error
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'unauthorized' });
        }
        //if the token is valid then it would be decoded
        console.log('value in the token', decoded);
        req.user = decoded;
        next();
    })

}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const serviceCollection = client.db('carDoctor').collection('services');
        const bookingCollection = client.db('carDoctor').collection('bookings');



        //auth related api

        //version-1

        // app.post('/jwt', logger, async (req, res) => {
        //     const user = req.body;
        //     console.log(user);
        //     const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        //     res
        //         .cookie('token', token, {
        //             httpOnly: true,
        //             secure: false, //for localhost secure false and for live host secure true
        //             sameSite: 'none'
        //         })
        //         .send({ success: true });
        // })

        //auth related api: version 2: recap
        app.post('/jwt', async (req, res) => {
            const user = req.body;



            //support=> for invalid token and logout. 
            //Explain: As the firebase is active so user is present alltime. So forcefully stop it when the token is invalid and logout

            console.log(req.cookies);
            if (req.cookies.token) {
                jwt.verify(req.cookies.token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                    //error
                    if (err) {
                        console.log(err);
                        return res.status(401).send({ message: 'unauthorized' });
                    }
                    //if the token is valid then it would be decoded
                    // console.log('value in the token', decoded);
                    // req.user = decoded;
                    // next();
                })
            }

            //support ends


            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production" ? true : false, //support
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict" //support
            })
                .send({ success: true })
        })

        //clear cookie when user logged out
        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out user', user);
            res.clearCookie('token', {
                maxAge: 0,
                secure: process.env.NODE_ENV === "production" ? true : false, //support
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict" //support
            })
                .send({ success: true })
        })




        //service related api

        app.get('/services', logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const options = {
                projection: {
                    title: 1,
                    price: 1,
                    service_id: 1,
                    img: 1
                }
            }
            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        })



        //bookings related api

        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            // console.log('token', req.cookies.token);
            console.log('cook cook cookies', req.cookies);
            console.log('user in the valid token', req.user);

            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            let query = {};
            if (req.query?.email) {
                query = {
                    email: req.query.email
                }
            }

            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            }
            const updatedBooking = req.body;
            console.log(updatedBooking);
            const updatedDoc = {
                $set: {
                    status: updatedBooking.status
                }
            }
            const result = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })









        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);









app.get("/", (req, res) => {
    res.send('Doctor is running');
})

app.listen(port, () => {
    console.log(`car doctor server is running on ${port}`);
})