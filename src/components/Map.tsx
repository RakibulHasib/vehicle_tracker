
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef } from "react";

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
const ENABLE_MOCK_LOCATION = false;

// Custom Icons
const busIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const personIcon = L.divIcon({
    html: `
        <svg viewBox="0 0 100 130" width="30" height="39" style="filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4))">
            <!-- Main Dark Green Pin Body -->
            <path d="M50,0 C22.4,0 0,22.4 0,50 C0,75 35,115 50,130 C65,115 100,75 100,50 C100,22.4 77.6,0 50,0 Z" fill="#1b5e20"/>
            
            <!-- Shadow Layer (similar to the darker red half on the bus pin) -->
            <path d="M50,0 C77.6,0 100,22.4 100,50 C100,75 65,115 50,130 L50,0 Z" fill="#144617" opacity="0.3"/>
            
            <!-- Inner Light White/Gray Circle -->
            <circle cx="50" cy="45" r="32" fill="#f0f0f0"/>
            
            <!-- Green User Icon in Center -->
            <g transform="translate(30, 25) scale(1.6)" fill="#2e7d32">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </g>
        </svg>
    `,
    className: '', // Remove default leaflet styles
    iconSize: [30, 39],
    iconAnchor: [15, 39],
    popupAnchor: [0, -39]
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
    const initialCenterDone = useRef(false);

    const map = useMapEvents({
        locationfound(e) {
            onLocationUpdate(e.latlng.lat, e.latlng.lng);
            onStatusChange('found');
            
            if (!initialCenterDone.current) {
                map.flyTo(e.latlng, 16);
                initialCenterDone.current = true;
            }
        },
        locationerror(e) {
            console.error('Location error:', e.message, 'Code:', e.code);

            if (ENABLE_MOCK_LOCATION) {
                console.log('Falling back to mock location for development...');

                // Use mock location as fallback
                setUseMockLocation(true);
                onStatusChange('mock', 'Using mock location (Dhaka University)');
                onLocationUpdate(MOCK_LOCATION.lat, MOCK_LOCATION.lng);

                if (!initialCenterDone.current) {
                    map.setView([MOCK_LOCATION.lat, MOCK_LOCATION.lng], 16);
                    initialCenterDone.current = true;
                }
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
                setView: false, // Changed from true to prevent map auto-jumping when user zooms/pans manually
                watch: true,
                enableHighAccuracy: true,
                timeout: 60000, // 60 seconds for WiFi-based location
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

// Center Location Button overlay
function CenterLocationButton({ lat, lng }: { lat?: number, lng?: number }) {
    const map = useMap();
    
    if (!lat || !lng) return null;
    
    return (
        <button 
            className="absolute bottom-6 right-4 bg-white p-2 rounded-full shadow-md z-[1000] border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                map.flyTo([lat, lng], 16);
            }}
            onPointerDown={(e) => e.stopPropagation()} // Overcome Leaflet map drag interception
            onDoubleClick={(e) => e.stopPropagation()}
            title="Move to my location"
            style={{ width: '48px', height: '48px' }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </button>
    );
}

// Sub-component for rendering other users and their popup logic
function OtherUserMarker({ user, currentUser }: { user: User, currentUser: User | null }) {
    const [showDistance, setShowDistance] = useState(false);

    const distance = currentUser && currentUser.lat && currentUser.lng ?
        L.latLng(currentUser.lat, currentUser.lng).distanceTo(L.latLng(user.lat, user.lng)) : null;

    return (
        <Marker position={[user.lat, user.lng]} icon={user.role === 'driver' ? busIcon : personIcon}>
            <Popup>
                <div className="text-center p-1 w-32">
                    <p className="font-bold mb-1">{user.name} <span className="text-xs text-gray-500 capitalize">({user.role})</span></p>

                    {currentUser && currentUser.lat && currentUser.role === 'student' ? (
                        showDistance && distance !== null ? (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-blue-600 p-1 bg-blue-50 rounded">
                                    {distance > 1000 ? (distance / 1000).toFixed(2) + ' km' : Math.round(distance) + ' m'}
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowDistance(false);
                                    }}
                                    className="mt-1 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded transition"
                                >
                                    Hide Distance
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowDistance(true);
                                }}
                                className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1.5 rounded transition shadow-sm"
                            >
                                Find Distance
                            </button>
                        )
                    ) : (
                        currentUser?.role !== 'student' ? null : <p className="text-xs text-red-500 mt-1">Location unknown</p>
                    )}
                </div>
            </Popup>

            {/* Draw a line if we are showing the distance */}
            {currentUser && currentUser.lat && currentUser.lng && showDistance && distance !== null && (
                <Polyline
                    positions={[
                        [currentUser.lat, currentUser.lng],
                        [user.lat, user.lng]
                    ]}
                    pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10' }} // Blue dashed line
                >
                    <Tooltip permanent direction="center" className="bg-white/90 font-bold text-blue-600 shadow-sm border-0">
                        {distance > 1000 ? (distance / 1000).toFixed(2) + ' km' : Math.round(distance) + ' m'}
                    </Tooltip>
                </Polyline>
            )}
        </Marker>
    );
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
                    <OtherUserMarker key={user.id} user={user} currentUser={currentUser} />
                ))}

                {/* Center to My Location Button */}
                <CenterLocationButton lat={currentUser?.lat} lng={currentUser?.lng} />
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
