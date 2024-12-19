const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4001;


// middleware
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:5173/",
    ],
    optionsSuccessStatus: 200,
}))

// api 
app.get("/", (req, res) => {
    res.send('LushLoooks is running');
});

app.listen(port, () => {
    console.log(`server is running on port >>>>>> ${port}`);
})