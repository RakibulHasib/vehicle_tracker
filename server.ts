import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });


    // In-memory store
    type User = {
        id: string; // socket.id
        role: "driver" | "student";
        name: string;
        details?: any; // vehicle info etc.
        lat?: number;
        lng?: number;
    };

    const users = new Map<string, User>();

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        // Register User
        socket.on("register", (data: { role: "driver" | "student"; name: string; details?: any }) => {
            const newUser: User = {
                id: socket.id,
                role: data.role,
                name: data.name,
                details: data.details,
            };
            users.set(socket.id, newUser);

            // Join rooms
            if (data.role === "driver") {
                socket.join("drivers");
                // Drivers see all students
                const students = Array.from(users.values()).filter(u => u.role === "student" && u.lat && u.lng);
                socket.emit("existing_users", students);
                // Broadcast presence to students (optional, or wait for location)
            } else {
                socket.join("students");
                // Students see all drivers
                const drivers = Array.from(users.values()).filter(u => u.role === "driver" && u.lat && u.lng);
                socket.emit("existing_users", drivers);
            }

            console.log(`Registered ${data.role}: ${data.name}`);
        });

        // Update Location
        socket.on("updateLocation", (coords: { lat: number; lng: number }) => {
            const user = users.get(socket.id);
            if (!user) return;

            user.lat = coords.lat;
            user.lng = coords.lng;

            if (user.role === "driver") {
                // Broadcast to all students
                io.to("students").emit("driverLocation", user);
            } else {
                // Broadcast to all drivers
                io.to("drivers").emit("studentLocation", user);
            }
        });

        socket.on("disconnect", () => {
            const user = users.get(socket.id);
            if (user) {
                if (user.role === "driver") {
                    io.to("students").emit("driverLeft", user.id);
                } else {
                    io.to("drivers").emit("studentLeft", user.id);
                }
                users.delete(socket.id);
                console.log(`Client disconnected: ${user.name} (${user.role})`);
            }
        });
    });


    server.all(/(.*)/, (req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
