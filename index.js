const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 3001;


// middleware
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:5173",
    ],
    optionsSuccessStatus: 200,
}))
// Becareful in origin url, Please avoid espace,extra slash (/, ) or other unwanted.**



// verify jwt 
const verifyToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.send({ message: "NO TOKEN" });
    }
    const token = authorization.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
        if (err) {
            return res.send({ message: "Invalid Token!" })
        }
        req.decoded = decoded;
        next()
    })
}

// Verify Seller 
const verifySeller = async (req, res, next) => {
    const userEmail = req.decoded.email;
    const query = { email: userEmail };
    const user = await userCollection.findOne(query);
    if (user.role !== 'seller') {
        return res.send({ message: "Forbidden access" });
    }
    next();
}

// Verify Buyer 
const verifyBuyer = async (req, res, next) => {
    const userEmail = req.decoded.email;
    const query = { email: userEmail };
    const user = await userCollection.findOne(query);
    if (user.role !== 'buyer') {
        return res.send({ message: "Forbidden access" });
    }
    next();
}



// mongoDB 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bm0qnz4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const userCollection = client.db("lushLooksDB").collection("users");
const productCollection = client.db("lushLooksDB").collection("products")


const dbConnect = async () => {
    try {
        client.connect();
        console.log('Data Base connected successfully.!!');

        // api 
        // post jwt 
        app.post('/authentication', (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, { expiresIn: "1d" });
            res.send({ token });
        })

        // get products 
        app.get("/products", async (req, res) => {
            const { title, sort, category, brand, } = req.query;

            const query = [];

            if (title) {
                query.title = { $regex: title, $options: "i" }
            }

            if (category) {
                query.category = category;
            }

            if (brand) {
                query.brand = brand;
            }

            const sortOption = sort === 'asc' ? 1 : -1



            const products = await productCollection
                .find(query)
                .sort({ price: sortOption })
                .toArray();

            const productInfo = await productCollection.find({}, {
                projection: {
                    category: 1,
                    brand: 1,
                }
            }).toArray();

            const Brands = { ...new Set(productInfo.map(product => product.brand)) };
            const Categories = { ...new Set(productInfo.map(product => product.category)) };

            res.json({ products, Brands, Categories })
        })

        // insert products 
        app.post("/products/add", async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result)
        })

        // get user 
        app.get("/users/:email", async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        // create user 
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };
            const existing = await userCollection.findOne(query);
            if (existing) {
                return res.send({ message: "user already exist!" }, { status: 304 });
            }

            const result = await userCollection.insertOne(user);
            res.send(result, { message: "Successfully account created." }, { status: 200 });
        })



    } catch (error) {
        console.log(error);
    }
};
dbConnect();


// api 
app.get("/", (req, res) => {
    res.send('LushLoooks is running');
});

app.listen(port, () => {
    console.log(`server is running on port >>>>>> ${port}`);
})