
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

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

// Configuration: Set to false to disable mock location (force real GPS only)
const ENABLE_MOCK_LOCATION = true;

// Custom Icons
const busIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const personIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/747/747376.png", // Better student/person icon
    iconSize: [35, 35],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
});

export type User = {
    id: string;
    role: "driver" | "student";
    lat: number;
    lng: number;
    name: string;
};

type LocationStatus = 'idle' | 'searching' | 'found' | 'error' | 'mock';

// Mock location for development/testing (Dhaka University area)
const MOCK_LOCATION = {
    lat: 23.7285,
    lng: 90.3944
};

// Component to handle location updates and map centering
function LocationHandler({
    onLocationUpdate,
    onStatusChange
}: {
    onLocationUpdate: (lat: number, lng: number) => void;
    onStatusChange: (status: LocationStatus, error?: string) => void;
}) {
    const [useMockLocation, setUseMockLocation] = useState(false);

    const map = useMapEvents({
        locationfound(e) {
            onLocationUpdate(e.latlng.lat, e.latlng.lng);
            onStatusChange('found');
            console.log('Location found:', e.latlng);
        },
        locationerror(e) {
            console.error('Location error:', e.message, 'Code:', e.code);

            if (ENABLE_MOCK_LOCATION) {
                console.log('Falling back to mock location for development...');

                // Use mock location as fallback
                setUseMockLocation(true);
                onStatusChange('mock', 'Using mock location (Dhaka University)');
                onLocationUpdate(MOCK_LOCATION.lat, MOCK_LOCATION.lng);

                // Center map on mock location
                map.setView([MOCK_LOCATION.lat, MOCK_LOCATION.lng], 15);
            } else {
                // Show error without fallback - forces real GPS only
                onStatusChange('error', e.message);
                console.warn('Mock location disabled. Please enable GPS or grant location permission.');
            }
        }
    });

    useEffect(() => {
        if (!useMockLocation) {
            onStatusChange('searching');
            map.locate({
                setView: true,
                watch: true,
                enableHighAccuracy: true,
                timeout: 30000, // 30 seconds for WiFi-based location
                maximumAge: 0
            });
        } else {
            // Simulate location updates for mock mode
            const interval = setInterval(() => {
                // Add small random movement to simulate GPS drift
                const lat = MOCK_LOCATION.lat + (Math.random() - 0.5) * 0.001;
                const lng = MOCK_LOCATION.lng + (Math.random() - 0.5) * 0.001;
                onLocationUpdate(lat, lng);
            }, 3000); // Update every 3 seconds

            return () => clearInterval(interval);
        }
    }, [map, useMockLocation]);

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
    const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
    const [locationError, setLocationError] = useState<string>('');

    const handleStatusChange = (status: LocationStatus, error?: string) => {
        setLocationStatus(status);
        if (error) {
            setLocationError(error);
        }
    };

    const getStatusColor = () => {
        switch (locationStatus) {
            case 'found': return 'bg-green-500';
            case 'mock': return 'bg-blue-500';
            case 'searching': return 'bg-yellow-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusText = () => {
        switch (locationStatus) {
            case 'found': return '📍 Location Active';
            case 'mock': return '🧪 Mock Location (Testing Mode)';
            case 'searching': return '🔍 Searching for GPS...';
            case 'error': return `❌ Error: ${locationError}`;
            default: return '⏳ Initializing...';
        }
    };

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <MapContainer center={[0, 0]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <LocationHandler onLocationUpdate={onLocationUpdate} onStatusChange={handleStatusChange} />

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

            {/* Location Status Overlay */}
            <div
                className={`absolute bottom-4 left-4 ${getStatusColor()} text-white px-4 py-2 rounded-lg shadow-lg z-[1000] text-sm font-semibold flex items-center gap-2`}
            >
                <span>{getStatusText()}</span>
                {locationStatus === 'error' && (
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100 transition"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
