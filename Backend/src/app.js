import express from "express";
import { createServer } from "node:http";
import dns from "node:dns";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import connectToSocket from "./controllers/socketManager.js";
import dotenv from "dotenv";
import userRoutes from "./routes/users.routes.js"

dotenv.config();


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

const { MONGO_URI, PORT, DNS_SERVERS } = process.env;

app.set("port", PORT || 8000);
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: true }));
app.use("/api/v1/users", userRoutes);


const start = async() => {
    if (!MONGO_URI) {
        throw new Error("MONGO_URI is not set");
    }

    const dnsList = DNS_SERVERS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (MONGO_URI.startsWith("mongodb+srv:") && dnsList?.length) {
        dns.setServers(dnsList);
    }

    try {
        const connectionDb = await mongoose.connect(MONGO_URI);
        console.log(`MONGO Connected to DB Host: ${connectionDb.connection.host}`);
        console.log("Connected to DB");
    } catch (err) {
        if (err?.code === "ECONNREFUSED" && err?.syscall === "querySrv") {
            console.error(
                "MongoDB SRV DNS lookup failed (mongodb+srv). Your network/DNS blocked or could not resolve Atlas.\n" +
                "Try: add DNS_SERVERS=8.8.8.8,1.1.1.1 to Backend/.env, or set PC DNS to 8.8.8.8, disable VPN, ipconfig /flushdns\n" +
                "Or use Atlas Standard connection string (mongodb://… not mongodb+srv://). Wrong password would fail *after* DNS with auth error, not querySrv."
            );
        }
        if (err?.code === 18 || String(err?.message || "").includes("bad auth")) {
            console.error(
                "MongoDB authentication failed. In Backend/.env, set MONGO_URI to use the DATABASE USER password from Atlas → Database Access (not your Atlas login).\n" +
                "If you reset the password, paste the new one into the URI and URL-encode special chars (@ → %40, # → %23, / → %2F)."
            );
        }
        throw err;
    }

    server.listen(app.get("port"), ()=>{
        console.log("Listening on Port 8000");
    });
}

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
