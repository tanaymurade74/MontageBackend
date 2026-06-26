const mongoose = require("mongoose")

require("dotenv").config();

const mongoUri = process.env.MONGODB;

const initializeDatabase = async () => {
    await mongoose.connect(mongoUri).then(() => console.log("Connected to DB.")).catch((error)=> console.log("Error occurred while connecting to DB", error));
}

module.exports = initializeDatabase;