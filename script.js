        import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
        import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

        // Firebase configuration (same as driver app)
        const firebaseConfig = {
            apiKey: "AIzaSyA2_R8fnWilxYeak1rIXpd2OH-44NZ7P7o",
            authDomain: "bus-driver-duet.firebaseapp.com",
            databaseURL: "https://bus-driver-duet-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "bus-driver-duet",
            storageBucket: "bus-driver-duet.firebasestorage.app",
            messagingSenderId: "412883985841",
            appId: "1:412883985841:web:99cf2eafe70b4dab864990"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const database = getDatabase(app);

        // Bus stops data
        const stops = [
            { name: "4K Chowrangi", lat: 25.005963, lng: 67.064562 },
            { name: "Power House Chowrangi", lat: 24.985976, lng: 67.065940 },
            { name: "Up Morr Station", lat: 24.973632, lng: 67.066827 },
            { name: "Nagan Chowrangi", lat: 24.964322, lng: 67.066866 },
            { name: "Sakhi Hassan", lat: 24.953785, lng: 67.058106 },
            { name: "People's Chowrangi", lat: 24.948024, lng: 67.065709 },
            { name: "Water Pump", lat: 24.936103, lng: 67.075335 },
            { name: "Aisha Manzil", lat: 24.926938, lng: 67.063899 },
            { name: "Teen Hatti", lat: 24.891752, lng: 67.043509 },
            { name: "Guru Mandir", lat: 24.880976, lng: 67.039385 },
            { name: "Dawood University", lat: 24.879408, lng: 67.047696 }
        ];

        let map, busMarker, routeLine, traveledLine;
        let roadRouteCoordinates = [];

        // Initialize map
        async function initMap() {
            const center = [24.942686, 67.056629];
            map = L.map('map').setView(center, 12);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            // Add stop markers
            stops.forEach((stop, index) => {
                const color = index === 0 ? '#4CAF50' : '#999';
                L.circleMarker([stop.lat, stop.lng], {
                    radius: 6,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map).bindPopup(stop.name);
            });

            // Create bus icon
            const busIcon = L.divIcon({
                className: 'bus-marker',
                html: `<div style="width: 40px; height: 40px; background: #FF5722; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 0 8px rgba(255, 87, 34, 0.2); border: 3px solid white;">🚌</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            busMarker = L.marker([stops[0].lat, stops[0].lng], { icon: busIcon }).addTo(map);

            // Fetch actual road route from OSRM
            await fetchRoadRoute();

            // Initialize traveled line (green)
            traveledLine = L.polyline([], {
                color: '#4CAF50',
                weight: 6,
                opacity: 0.9
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }

        // Fetch road route using OSRM (follows actual roads)
        async function fetchRoadRoute() {
            try {
                const coordinates = stops.map(stop => `${stop.lng},${stop.lat}`).join(';');
                const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.code === 'Ok' && data.routes.length > 0) {
                    const routeGeometry = data.routes[0].geometry.coordinates;
                    roadRouteCoordinates = routeGeometry.map(coord => [coord[1], coord[0]]);
                    
                    routeLine = L.polyline(roadRouteCoordinates, {
                        color: '#2196F3',
                        weight: 4,
                        opacity: 0.6
                    }).addTo(map);
                } else {
                    // Fallback to straight lines
                    roadRouteCoordinates = stops.map(stop => [stop.lat, stop.lng]);
                    routeLine = L.polyline(roadRouteCoordinates, {
                        color: '#2196F3',
                        weight: 4,
                        opacity: 0.6
                    }).addTo(map);
                }
            } catch (error) {
                console.error('Error fetching route:', error);
                roadRouteCoordinates = stops.map(stop => [stop.lat, stop.lng]);
                routeLine = L.polyline(roadRouteCoordinates, {
                    color: '#2196F3',
                    weight: 4,
                    opacity: 0.6
                }).addTo(map);
            }
        }

        // Calculate distance
        function getDistance(lat1, lng1, lat2, lng2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                     Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        // Update UI with bus location
        function updateBusLocation(data) {
            if (!data || !data.latitude || !data.longitude) return;

            const { latitude, longitude, speed } = data;

            // Update bus position on map
            busMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], 15);

            // Update traveled path (green line) - only show path BEHIND the bus
            if (roadRouteCoordinates.length > 0) {
                let closestIndex = 0;
                let minDistToRoute = Infinity;
                
                // Find the closest point on the route to the bus
                for (let i = 0; i < roadRouteCoordinates.length; i++) {
                    const routePoint = roadRouteCoordinates[i];
                    const dist = getDistance(latitude, longitude, routePoint[0], routePoint[1]);
                    
                    if (dist < minDistToRoute) {
                        minDistToRoute = dist;
                        closestIndex = i;
                    }
                }
                
                // Get only the traveled portion (from start to current position)
                const traveledPath = roadRouteCoordinates.slice(0, closestIndex + 1);
                traveledLine.setLatLngs(traveledPath);
            }

            // Find closest stops
            let closestPrevIndex = 0;
            let closestNextIndex = 1;
            let minDist = Infinity;

            for (let i = 0; i < stops.length - 1; i++) {
                const dist = getDistance(latitude, longitude, stops[i].lat, stops[i].lng);
                if (dist < minDist) {
                    minDist = dist;
                    closestPrevIndex = i;
                    closestNextIndex = Math.min(i + 1, stops.length - 1);
                }
            }

            const prevStop = stops[closestPrevIndex];
            const nextStop = stops[closestNextIndex];

            // Calculate ETA to next stop
            const distToNext = getDistance(latitude, longitude, nextStop.lat, nextStop.lng);
            const speedKmh = speed || 30;
            const etaMinutes = Math.max(1, Math.round((distToNext / speedKmh) * 60));

            // Update UI
            document.getElementById('prevStop').textContent = prevStop.name;
            document.getElementById('nextStop').textContent = nextStop.name;
            document.getElementById('speedDisplay').textContent = Math.round(speedKmh);
            document.getElementById('timeDisplay').textContent = etaMinutes;
            document.getElementById('etaDisplay').textContent = `ETA: ${etaMinutes} min`;
            document.getElementById('prevTime').textContent = 'Departed';

            // Update progress dots
            document.querySelectorAll('.stop-point').forEach((point, index) => {
                point.classList.remove('completed', 'active');
                if (index < closestPrevIndex) {
                    point.classList.add('completed');
                } else if (index === closestPrevIndex || index === closestNextIndex) {
                    point.classList.add('active');
                }
            });

            document.querySelectorAll('.progress-connector').forEach((connector, index) => {
                connector.classList.remove('completed');
                if (index < closestPrevIndex) {
                    connector.classList.add('completed');
                }
            });
        }

        // Listen to Firebase real-time updates
        const locationRef = ref(database, 'busLocation');
        onValue(locationRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateBusLocation(data);
            }
        });

        // Initialize map on load
        window.onload = initMap;
