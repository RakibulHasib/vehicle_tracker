import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { io, Socket } from "socket.io-client";
import type { User } from "../components/Map";

// Dynamic import for Map to disable SSR
const MapComponent = dynamic(() => import("../components/Map"), { ssr: false });

let socket: Socket;

export default function Home() {
  const [role, setRole] = useState<"driver" | "student">("student");
  const [name, setName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUsers, setOtherUsers] = useState<User[]>([]);

  // Use a ref to keep track of the latest state for closure in event listeners
  const stateRef = useRef({ role, name, vehicleId, isLoggedIn, currentUser });

  useEffect(() => {
    stateRef.current = { role, name, vehicleId, isLoggedIn, currentUser };
  }, [role, name, vehicleId, isLoggedIn, currentUser]);

  useEffect(() => {
    // Initialize socket connection
    socket = io();

    socket.on("connect", () => {
      console.log("Connected to server", socket.id);

      const state = stateRef.current;
      if (state.isLoggedIn && state.name) {
        console.log("Socket reconnected. Re-registering user...");
        const details = state.role === "driver" ? { vehicleId: state.vehicleId } : {};
        socket.emit("register", { role: state.role, name: state.name, details });

        // Update the current user ID to the new socket ID just in case
        if (state.currentUser) {
          setCurrentUser({ ...state.currentUser, id: socket.id! });
        }
      }
    });

    socket.on("existing_users", (users: User[]) => {
      setOtherUsers(users);
    });

    socket.on("driverLocation", (user: User) => {
      setOtherUsers(prev => {
        const index = prev.findIndex(u => u.id === user.id);
        if (index !== -1) {
          const newUsers = [...prev];
          newUsers[index] = user;
          return newUsers;
        }
        return [...prev, user];
      });
    });

    socket.on("studentLocation", (user: User) => {
      setOtherUsers(prev => {
        const index = prev.findIndex(u => u.id === user.id);
        if (index !== -1) {
          const newUsers = [...prev];
          newUsers[index] = user;
          return newUsers;
        }
        return [...prev, user];
      });
    });

    const handleUserLeft = (id: string) => {
      setOtherUsers(prev => prev.filter(u => u.id !== id));
    };

    socket.on("driverLeft", handleUserLeft);
    socket.on("studentLeft", handleUserLeft);

    return () => {
      // Don't disconnect on unmount in dev usually to avoid flicker, but strictly clean:
      if (socket) socket.disconnect();
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const details = role === "driver" ? { vehicleId } : {};
    socket.emit("register", { role, name, details });

    setCurrentUser({ id: socket.id!, role, name, lat: 0, lng: 0 });
    setIsLoggedIn(true);
  };

  const onLocationUpdate = (lat: number, lng: number) => {
    if (!currentUser) return;

    // Only update if moved significantly or throttle? For MVP, every update is fine.
    const updatedUser = { ...currentUser, lat, lng };
    setCurrentUser(updatedUser);

    if (socket) {
      socket.emit("updateLocation", { lat, lng });
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="w-full max-w-md bg-white p-8 rounded shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">University Bus Tracking</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Role</label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`flex-1 py-2 rounded border ${role === "student" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole("driver")}
                  className={`flex-1 py-2 rounded border ${role === "driver" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  Driver
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                placeholder="Enter your name"
                required
              />
            </div>

            {role === "driver" && (
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Vehicle ID</label>
                <input
                  type="text"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  placeholder="Bus Number / Plate"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition"
            >
              Start Tracking
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative">
      <MapComponent currentUser={currentUser} otherUsers={otherUsers} onLocationUpdate={onLocationUpdate} />

      <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg z-[1000] border border-gray-200">
        <h2 className="font-bold text-lg mb-2 text-gray-800">Status</h2>
        <div className="text-sm text-gray-600">
          <p><strong>You:</strong> {name} ({role})</p>
          <p><strong>Others:</strong> {otherUsers.length} online</p>
          {role === 'student' && <p>Looking for buses...</p>}
          {role === 'driver' && <p>Broadcasting location...</p>}
        </div>
      </div>
    </div>
  );
}
