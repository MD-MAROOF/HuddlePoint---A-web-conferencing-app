import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};
let userInfo = {}; // socketId -> { username }

const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {

        socket.on("join-call", (path, username) => {

            if (connections[path] === undefined)
                connections[path] = [];

            if (connections[path].includes(socket.id))
                return;

            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();
            userInfo[socket.id] = { username: username || "Participant" };

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path], userInfo);
            }

            if (messages[path] != undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit(
                        "chat-message",
                        messages[path][a]["data"],
                        messages[path][a]["sender"],
                        messages[path][a]["socket-id-sender"]
                    );
                }
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                },
                ["", false]
            );

            if (found) {
                if (messages[matchingRoom] == undefined) {
                    messages[matchingRoom] = [];
                }

                messages[matchingRoom].push({
                    sender,
                    data,
                    "socket-id-sender": socket.id
                });

                // Broadcast to all room members (including sender for confirmation)
                connections[matchingRoom].forEach((memberId) => {
                    io.to(memberId).emit("chat-message", data, sender, socket.id);
                });
            }
        });

        socket.on("disconnect", () => {
            delete timeOnline[socket.id];
            delete userInfo[socket.id];

            for (const roomPath of Object.keys(connections)) {
                const room = connections[roomPath];
                const index = room.indexOf(socket.id);
                if (index === -1) continue;

                room.forEach((memberId) => {
                    io.to(memberId).emit("user-left", socket.id);
                });

                room.splice(index, 1);

                if (room.length === 0) {
                    delete connections[roomPath];
                    delete messages[roomPath];
                }
            }
        });
    });

    return io;
};

export default connectToSocket;
