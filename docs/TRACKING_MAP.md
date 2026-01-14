# Live Tracking Map Feature

This document describes the live tracking map feature that has been integrated into the Codename-Blood application.

## Overview

The live tracking map provides real-time GPS location tracking for bikes and riders. It uses WebSockets for real-time updates and displays tracked entities on an interactive map using Leaflet.js.

## Architecture

### Backend Components

#### 1. Location Tracking Models (`backend/internal/tracking/models.go`)
- `LocationUpdate`: Represents a GPS location update from a tracked entity
- `TrackedEntity`: Metadata about entities being tracked
- `ValidateCoordinates()`: Validates GPS coordinates

#### 2. In-Memory Store (`backend/internal/tracking/store.go`)
- Maintains location data in memory
- Manages WebSocket client connections
- Broadcasts updates to all connected clients
- Automatically cleans up stale location data (5-minute timeout)
- Thread-safe operations using mutexes

#### 3. HTTP and WebSocket Handlers (`backend/internal/tracking/handlers.go`)
- `HandleLocationUpdate`: HTTP POST endpoint to receive location updates
- `HandleGetLocations`: HTTP GET endpoint to retrieve all active locations
- `HandleGetEntities`: HTTP GET endpoint to retrieve all tracked entities
- `HandleWebSocket`: WebSocket endpoint for real-time updates

### Frontend Components

#### 1. Location Models (`frontend/blood-bike-web/src/app/models/location.model.ts`)
- TypeScript interfaces matching backend data structures
- `LocationUpdate`, `TrackedEntity`, `WebSocketMessage`

#### 2. Location Tracking Service (`frontend/blood-bike-web/src/app/services/location-tracking.service.ts`)
- Angular service for interacting with tracking APIs
- WebSocket connection management with auto-reconnect
- Observable streams for real-time updates
- HTTP methods for REST API calls

#### 3. Tracking Map Component (`frontend/blood-bike-web/src/app/components/tracking-map.component.*`)
- Interactive Leaflet map showing tracked entities
- Real-time marker updates with smooth animations
- Entity selection and auto-follow functionality
- Connection status indicator
- Info panel with entity list and details
- Responsive design for mobile and desktop

## API Endpoints

### HTTP Endpoints

#### POST `/api/tracking/update`
Submit a location update.

**Request Body:**
```json
{
  "entityId": "bike-001",
  "entityType": "bike",
  "latitude": 51.5074,
  "longitude": -0.1278,
  "speed": 45.5,
  "heading": 180,
  "altitude": 100,
  "accuracy": 10,
  "timestamp": "2026-01-14T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "location updated"
}
```

#### GET `/api/tracking/locations`
Retrieve all active (non-stale) locations.

**Response:**
```json
[
  {
    "entityId": "bike-001",
    "entityType": "bike",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "speed": 45.5,
    "heading": 180,
    "altitude": 100,
    "accuracy": 10,
    "timestamp": "2026-01-14T12:00:00Z",
    "updatedAt": "2026-01-14T12:00:01Z"
  }
]
```

#### GET `/api/tracking/entities`
Retrieve all tracked entities with their status.

**Response:**
```json
[
  {
    "entityId": "bike-001",
    "entityType": "bike",
    "name": "bike-001",
    "isActive": true,
    "lastUpdateTime": "2026-01-14T12:00:01Z",
    "lastLocation": { ... }
  }
]
```

### WebSocket Endpoint

#### WS `/api/tracking/ws`
WebSocket connection for real-time location updates.

**Initial Message (sent to client on connection):**
```json
{
  "type": "initial",
  "locations": [ ... ]
}
```

**Update Message (broadcasted to all clients):**
```json
{
  "type": "update",
  "location": {
    "entityId": "bike-001",
    "entityType": "bike",
    "latitude": 51.5074,
    "longitude": -0.1278,
    ...
  }
}
```

**Client can also send location updates via WebSocket:**
```json
{
  "entityId": "bike-001",
  "entityType": "bike",
  "latitude": 51.5074,
  "longitude": -0.1278,
  ...
}
```

## Data Flow

1. **Location Update Submission:**
   - Device/client sends GPS location via HTTP POST or WebSocket
   - Backend validates coordinates and entity information
   - Location is stored in memory and broadcasted to all WebSocket clients

2. **Real-Time Updates:**
   - Frontend connects to WebSocket on map load
   - Receives initial snapshot of all locations
   - Receives real-time updates as they arrive
   - Updates map markers with smooth animations

3. **Stale Data Handling:**
   - Locations older than 5 minutes are marked as stale
   - Stale locations shown with gray markers
   - Background task cleans up stale data every 30 seconds

## Setup Instructions

### Backend Setup

1. The tracking feature is automatically initialized in `main.go`
2. No additional configuration required
3. WebSocket runs on the same port as the HTTP server (default: 8080)

### Frontend Setup

1. Leaflet.js is already installed and configured in `angular.json`
2. The tracking map is integrated into the app navigation
3. Access the map at `/tracking` route or click "Map" in the navigation

### Testing with Sample Data

Use the provided simulation script to send test location data:

```bash
# Start the backend server
cd backend
go run main.go

# In another terminal, run the simulation script
cd scripts
./simulate-tracking.sh

# Customize entity ID and type
ENTITY_ID=rider-001 ENTITY_TYPE=rider ./simulate-tracking.sh

# Test with multiple entities (run multiple instances)
ENTITY_ID=bike-001 ENTITY_TYPE=bike ./simulate-tracking.sh &
ENTITY_ID=bike-002 ENTITY_TYPE=bike ./simulate-tracking.sh &
ENTITY_ID=rider-001 ENTITY_TYPE=rider ./simulate-tracking.sh &
```

## Features

### Map Features
- ✅ Real-time location updates via WebSocket
- ✅ Smooth marker animations
- ✅ Auto-follow selected entity
- ✅ Fit view to all markers
- ✅ Connection status indicator
- ✅ Stale location detection and visual indication
- ✅ Detailed entity information panel
- ✅ Responsive design for mobile and desktop

### Backend Features
- ✅ WebSocket support for real-time updates
- ✅ HTTP REST API for location submission
- ✅ In-memory storage with thread-safe operations
- ✅ Automatic stale data cleanup
- ✅ Coordinate validation
- ✅ Support for multiple entity types (bike/rider)
- ✅ Efficient broadcast to multiple clients

### Frontend Features
- ✅ WebSocket auto-reconnect with exponential backoff
- ✅ Observable streams for reactive updates
- ✅ Entity selection and tracking
- ✅ Last update timestamps
- ✅ Speed, heading, altitude, and accuracy display
- ✅ Interactive marker popups

## Environment Variables

No additional environment variables are required. The feature uses existing configuration.

## Browser Support

The tracking map works in all modern browsers that support:
- WebSockets
- ES6+
- HTML5 Geolocation API (optional, for device location)

## Performance Considerations

### Backend
- In-memory storage for low latency
- Efficient WebSocket broadcasting
- Configurable stale timeout (default: 5 minutes)
- Client buffer size: 256 messages
- Slow clients are skipped to prevent blocking

### Frontend
- WebSocket message batching
- Smooth marker animations (1 second duration)
- Lazy rendering for large numbers of entities
- Automatic cleanup on component destroy

## Security Considerations

### Current Implementation
- CORS allows all origins (development mode)
- No authentication on tracking endpoints
- WebSocket accepts all connections

### Production Recommendations
1. Enable CORS restrictions in `tracking/handlers.go`
2. Add authentication to tracking endpoints
3. Validate entity IDs against authorized devices
4. Implement rate limiting for location updates
5. Use secure WebSocket (WSS) in production
6. Add JWT token validation for WebSocket connections

## Future Enhancements

Potential improvements for future development:
- [ ] Persistent storage (database integration)
- [ ] Historical location tracking and playback
- [ ] Geofencing and alerts
- [ ] Route optimization
- [ ] Multiple map tile providers
- [ ] Custom marker icons per entity type
- [ ] Location accuracy visualization (circles)
- [ ] Battery level tracking
- [ ] Offline support with queue sync
- [ ] Advanced filtering and search
- [ ] Export location history

## Troubleshooting

### WebSocket Connection Issues
- Check backend is running on expected port
- Verify proxy configuration in `proxy.conf.json`
- Check browser console for WebSocket errors
- Ensure firewall allows WebSocket connections

### No Location Updates Appearing
- Verify location data is being sent to backend
- Check backend logs for errors
- Ensure coordinates are valid (lat: -90 to 90, lon: -180 to 180)
- Check entity type is "bike" or "rider"

### Markers Not Animating
- Check browser performance
- Reduce animation duration in component
- Verify Leaflet.js is properly loaded

## Support

For issues or questions, refer to the main project README or contact the development team.
