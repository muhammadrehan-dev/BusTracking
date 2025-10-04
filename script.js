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

        let map;
        let busMarker;
        let routeLine;

        // Store actual road route coordinates
        let roadRouteCoordinates = [];

        // Initialize Leaflet Map
        async function initMap() {
            // Center map on route midpoint (Karachi)
            const center = [24.942686, 67.056629];
            
            // Create map
            map = L.map('map').setView(center, 12);
            
            // Add OpenStreetMap tiles (FREE!)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            // Add stop markers first
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

            // Create custom bus icon
            const busIcon = L.divIcon({
                className: 'bus-marker',
                html: `
                    <div style="
                        width: 40px;
                        height: 40px;
                        background: #FF5722;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        box-shadow: 0 0 0 8px rgba(255, 87, 34, 0.2);
                        border: 3px solid white;
                    ">🚌</div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            // Add bus marker (initially at first stop)
            busMarker = L.marker([stops[0].lat, stops[0].lng], {
                icon: busIcon
            }).addTo(map);

            // Fetch actual road route from OSRM
            await fetchRoadRoute();

            // Fit map to show entire route
            if (routeLine) {
                map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            }
        }

        // Fetch road route using OSRM (follows actual roads)
        async function fetchRoadRoute() {
            try {
                // Build coordinates string for OSRM API
                const coordinates = stops.map(stop => `${stop.lng},${stop.lat}`).join(';');
                
                // OSRM API endpoint (FREE!)
                const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.code === 'Ok' && data.routes.length > 0) {
                    // Get the route geometry (actual road coordinates)
                    const routeGeometry = data.routes[0].geometry.coordinates;
                    
                    // Convert from [lng, lat] to [lat, lng] for Leaflet
                    roadRouteCoordinates = routeGeometry.map(coord => [coord[1], coord[0]]);
                    
                    // Draw route line following roads
                    routeLine = L.polyline(roadRouteCoordinates, {
                        color: '#2196F3',
                        weight: 4,
                        opacity: 0.8
                    }).addTo(map);
                    
                    console.log('Road route loaded successfully!');
                } else {
                    console.error('OSRM routing failed, using straight line fallback');
                    // Fallback to straight lines if OSRM fails
                    const straightRoute = stops.map(stop => [stop.lat, stop.lng]);
                    roadRouteCoordinates = straightRoute;
                    routeLine = L.polyline(straightRoute, {
                        color: '#2196F3',
                        weight: 4,
                        opacity: 0.8
                    }).addTo(map);
                }
            } catch (error) {
                console.error('Error fetching route:', error);
                // Fallback to straight lines
                const straightRoute = stops.map(stop => [stop.lat, stop.lng]);
                roadRouteCoordinates = straightRoute;
                routeLine = L.polyline(straightRoute, {
                    color: '#2196F3',
                    weight: 4,
                    opacity: 0.8
                }).addTo(map);
            }
        }

        // Initialize map when page loads
        window.onload = initMap;

        // Helper function to calculate distance between two coordinates
        function getDistance(lat1, lng1, lat2, lng2) {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                     Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // Distance in km
        }

        // Demo: Simulate bus movement along actual road
        let routeProgress = 0;
        function simulateBusMovement() {
            setInterval(() => {
                if (roadRouteCoordinates.length === 0) return;
                
                // Move along the actual road coordinates
                routeProgress += 3; // Move 3 points forward each time
                if (routeProgress >= roadRouteCoordinates.length) {
                    routeProgress = 0; // Reset to start
                }
                
                // Get current position on road
                const currentPos = roadRouteCoordinates[routeProgress];
                
                // Update bus position on map
                busMarker.setLatLng(currentPos);
                
                // Find closest stop BEHIND the bus (previous stop)
                let previousStopIndex = 0;
                let minDistanceBehind = Infinity;
                
                for (let i = 0; i < stops.length; i++) {
                    const dist = getDistance(currentPos[0], currentPos[1], stops[i].lat, stops[i].lng);
                    
                    // Check if this stop is behind (already passed)
                    let isBehind = false;
                    for (let j = 0; j <= routeProgress && j < roadRouteCoordinates.length; j++) {
                        const roadPoint = roadRouteCoordinates[j];
                        const distToStop = getDistance(roadPoint[0], roadPoint[1], stops[i].lat, stops[i].lng);
                        if (distToStop < 0.1) { // Within 100 meters
                            isBehind = true;
                            break;
                        }
                    }
                    
                    if (isBehind && dist < minDistanceBehind) {
                        minDistanceBehind = dist;
                        previousStopIndex = i;
                    }
                }
                
                // Next stop is simply the one after previous
                const nextStopIndex = Math.min(previousStopIndex + 1, stops.length - 1);
                
                const previousStop = stops[previousStopIndex];
                const nextStop = stops[nextStopIndex];
                
                // Calculate distance to next stop
                const distanceToNext = getDistance(currentPos[0], currentPos[1], nextStop.lat, nextStop.lng);
                const estimatedSpeed = 40 + Math.random() * 20; // 40-60 km/h
                const timeToNext = Math.round((distanceToNext / estimatedSpeed) * 60); // Convert to minutes
                
                // Update UI with correct information
                document.getElementById('prevStop').textContent = previousStop.name;
                document.getElementById('nextStop').textContent = nextStop.name;
                document.getElementById('speedDisplay').textContent = Math.floor(estimatedSpeed);
                document.getElementById('timeDisplay').textContent = Math.max(1, timeToNext);
                document.getElementById('etaDisplay').textContent = `ETA: ${Math.max(1, timeToNext)} min`;
                
                // Update progress dots to match actual position
                document.querySelectorAll('.stop-point').forEach((point, index) => {
                    point.classList.remove('completed', 'active');
                    if (index < previousStopIndex) {
                        point.classList.add('completed');
                    } else if (index === previousStopIndex || index === nextStopIndex) {
                        point.classList.add('active');
                    }
                });
                
                document.querySelectorAll('.progress-connector').forEach((connector, index) => {
                    connector.classList.remove('completed');
                    if (index < previousStopIndex) {
                        connector.classList.add('completed');
                    }
                });
            }, 2000);
        }

        // Start simulation
        simulateBusMovement();