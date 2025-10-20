require('dotenv').config();
require('express-async-errors');
const express = require('express');
const app = express();

const connectDB = require('./db/connect');
const helmet = require('helmet');
const cors = require('cors');
const stringRoutes = require('./routes/stringRoutes');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

app.use(express.json());
app.use(helmet());
app.use(cors());


app.use('/api/v1/strings', stringRoutes);
app.get("/", (req, res) => {
  res.json({ message: "String Analyzer API", version: "1.0.0" });
});




app.use(notFound);
app.use(errorHandlerMiddleware);




const PORT = process.env.PORT || 5000;

const start = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.log('Error starting the server:', error);
    }
}

start();