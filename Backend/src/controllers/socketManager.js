import { Server } from "socket.io";

let connections = {}
let messages = {}
let timeOnline = {}

const connectToSocket = (server) => {
    const io = new Server(server);


    io.on("connection", () => {

        socket.on("join-call", (path) => {

            if (connections[path] === undefined)
                connections[path] = []

            connections.path.push(socket.id)
            timeOnline[socket.id] = new Date();

            for(let a = 0; a<connections[path].length;a++)
            {
                io.to(connections[path][a]).emit("user-joined", socket.id);
            }
        })

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("chat-message", (data, sender) => {

        })


        socket.on("disconnect", () => {

        })
    })


    return io;
}

export default connectToSocket;