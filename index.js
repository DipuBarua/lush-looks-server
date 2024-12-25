const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3001;


// middleware
// Becareful in origin url, Please avoid espace,extra slash (/, ) or other unwanted.**

app.use(express.json());
app.use(cors({
    origin: [
        "https://lush-looks-client.vercel.app",
        "http://localhost:5173",
    ],
    optionsSuccessStatus: 200,
}))


// Create jwt with post method. 
app.post('/authentication', (req, res) => {
    const userEmail = req.body;
    const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, { expiresIn: "1d" });
    res.send({ token });
})


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

// Verify Admin 
const verifyAdmin = async (req, res, next) => {
    const userEmail = req.decoded.email;
    const query = { email: userEmail };
    const user = await userCollection.findOne(query);
    if (user.role !== 'admin') {
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

        // get wishlist 
        app.get('/wishlist/:userId', verifyToken, async (req, res) => {
            const userId = req.params.userId;
            const query = { _id: new ObjectId(String(userId)) };
            const user = await userCollection.findOne(query);

            if (!user) {
                return res.send({ message: "forbidden access" })
            }

            const wishlist = await productCollection.find(
                {
                    _id: { $in: user.wishlist || [] }
                }
            ).toArray()

            res.send(wishlist)
        })

        // update wishlist to add card
        app.patch('/wishlist/add', async (req, res) => {
            const { userEmail, productId } = req.body;
            const result = await userCollection.updateOne(
                { email: userEmail },
                {
                    $addToSet: {
                        wishlist: new ObjectId(String(productId))
                    }
                }
            )
            res.send(result);
        })

        // update to remove from wishlist 
        app.patch('/wishlist/remove', async (req, res) => {
            const { userEmail, productId } = req.body;
            const result = await userCollection.updateOne(
                { email: userEmail },
                {
                    $pull: {
                        wishlist: new ObjectId(String(productId))
                    }
                }
            )
            res.send(result);
        })

        // get all products* 
        app.get("/all-products", async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result)
        })

        // get product|details*
        app.get("/product/details/:id", async (req, res) => {
            const query = { _id: new ObjectId(String(req.params.id)) }
            const result = await productCollection.findOne(query);
            res.send(result);
        })

        // get edit-product | seller*
        app.get("/seller/edit-product/:id", async (req, res) => {
            const query = { _id: new ObjectId(String(req.params.id)) }
            const result = await productCollection.findOne(query);
            res.send(result);
        })

        // get my-products | seller*
        app.get("/seller/my-products/:email", async (req, res) => {
            const result = await productCollection.aggregate(
                [
                    {
                        $match: { email: `${req.params.email}` }
                    }
                ]
            ).toArray();
            res.send(result);
        })

        // get products* 
        app.get("/products", async (req, res) => {
            const { title, sort, category, brand, page, limit } = req.query;

            const query = {};

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

            // pagination* 
            const totalProducts = await productCollection.countDocuments(query);
            const intPage = parseInt(page);
            const intLimit = parseInt(limit);

            const products = await productCollection
                .find(query)
                .skip((intPage - 1) * intLimit)
                .limit(intLimit)
                .sort({ price: sortOption })
                .toArray();

            const productInfo = await productCollection.find({}, {
                projection: {
                    category: 1,
                    brand: 1,
                }
            }).toArray();

            const Brands = [...new Set(productInfo.map(product => product.brand))];
            const Categories = [...new Set(productInfo.map(product => product.category))];

            res.send({ products, Brands, Categories, totalProducts })
        })

        // insert products* 
        app.post("/products/add", verifyToken, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result)
        })

        // update my-product | seller*
        app.patch('/seller/edit-product/:id', verifyToken, verifySeller, async (req, res) => {
            const queryProduct = { _id: new ObjectId(String(req.params.id)) }
            const product = req.body;
            const updateProduct = {
                title: product.title,
                brand: product.brand,
                stock: product.stock,
                price: product.price,
                category: product.category,
                image: product.image,
                description: product.description,
                //email: product.email,
            }
            const updated = await productCollection.updateOne(
                queryProduct,
                { $set: updateProduct },
            );

            res.send(updated);
        })

        // delete my-product | seller*
        app.delete("/seller/delete-product/:id", verifyToken, verifySeller, async (req, res) => {
            const query = { _id: new ObjectId(String(req.params.id)) };
            const deleted = await productCollection.deleteOne(query);
            res.send(deleted);
        })


        // get all users | admin*
        app.get("/admin/users", async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // get user*
        app.get("/users/:email", async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        // create user* 
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


// api testing
app.get("/", (req, res) => {
    res.send('LushLoooks is running');
});

app.listen(port, () => {
    console.log(`server is running on port >>>>>> ${port}`);
})