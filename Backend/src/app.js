import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import connectToSocket from "./controllers/socketmanager.js";
import dotenv from "dotenv";
import userRoutes from "./routes/users.routes.js"

dotenv.config();


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

const { MONGO_URI, PORT } = process.env;

app.set("port", PORT || 8000);
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: true }));
app.use("/api/v1/users", userRoutes);



const start = async() => {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI is not set");
    }

    const connectionDb = await mongoose.connect(MONGO_URI);

    console.log(`MONGO Connected to DB Host: ${connectionDb.connection.host}`);
    console.log("Connected to DB");
    server.listen(app.get("port"), ()=>{
        console.log("Listening on Port 8000");
    });


}

start();
