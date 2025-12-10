
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Fix for default Leaflet icons in Next.js
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

// Custom Icons
const busIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const personIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/5363/5363451.png",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
});

export type User = {
    id: string;
    role: "driver" | "student";
    lat: number;
    lng: number;
    name: string;
};

// Component to handle location updates and map centering
function LocationHandler({ onLocationUpdate }: { onLocationUpdate: (lat: number, lng: number) => void }) {
    const map = useMapEvents({
        locationfound(e) {
            onLocationUpdate(e.latlng.lat, e.latlng.lng);
            // Optional: Only fly to location on first load or if user requests it? 
            // For MVP, we'll keep updating map view to follow user or just let them pan.
            // Let's not force flyTo every time to allow panning.
        },
    });

    useEffect(() => {
        map.locate({ setView: true, watch: true, enableHighAccuracy: true });
    }, [map]);

    return null;
}

export default function MapComponent({
    currentUser,
    otherUsers,
    onLocationUpdate
}: {
    currentUser: User | null,
    otherUsers: User[],
    onLocationUpdate: (lat: number, lng: number) => void
}) {
    return (
        <MapContainer center={[0, 0]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <LocationHandler onLocationUpdate={onLocationUpdate} />

            {/* Current User Marker */}
            {currentUser && currentUser.lat && (
                <Marker position={[currentUser.lat, currentUser.lng]} icon={currentUser.role === 'driver' ? busIcon : personIcon}>
                    <Popup>You ({currentUser.name})</Popup>
                </Marker>
            )}

            {/* Other Users */}
            {otherUsers.map(user => (
                <Marker key={user.id} position={[user.lat, user.lng]} icon={user.role === 'driver' ? busIcon : personIcon}>
                    <Popup>{user.name} ({user.role})</Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
