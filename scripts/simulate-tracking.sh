#!/bin/bash

# Sample script to send location updates to the tracking API
# This simulates a GPS-enabled device (bike or rider) sending location data

API_URL="${API_URL:-http://localhost:8080}"
ENTITY_ID="${ENTITY_ID:-bike-001}"
ENTITY_TYPE="${ENTITY_TYPE:-bike}"

# Starting location (London, UK as example)
LAT=51.5074
LON=-0.1278

echo "Sending location updates for $ENTITY_TYPE: $ENTITY_ID"
echo "Press Ctrl+C to stop"
echo ""

# Send location updates every 3 seconds with slight movement
while true; do
  # Add small random movement (simulating movement)
  LAT=$(echo "$LAT + (($RANDOM % 20 - 10) * 0.0001)" | bc -l)
  LON=$(echo "$LON + (($RANDOM % 20 - 10) * 0.0001)" | bc -l)
  
  # Random speed between 20-60 km/h
  SPEED=$((20 + $RANDOM % 40))
  
  # Random heading 0-359 degrees
  HEADING=$(($RANDOM % 360))
  
  # Accuracy around 5-15 meters
  ACCURACY=$((5 + $RANDOM % 10))
  
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  JSON_DATA=$(cat <<EOF
{
  "entityId": "$ENTITY_ID",
  "entityType": "$ENTITY_TYPE",
  "latitude": $LAT,
  "longitude": $LON,
  "speed": $SPEED,
  "heading": $HEADING,
  "accuracy": $ACCURACY,
  "timestamp": "$TIMESTAMP"
}
EOF
)
  
  echo "[$TIMESTAMP] Sending update: lat=$LAT, lon=$LON, speed=${SPEED}km/h, heading=${HEADING}°"
  
  curl -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_DATA" \
    "$API_URL/api/tracking/update" \
    -s -o /dev/null -w "Status: %{http_code}\n"
  
  echo ""
  sleep 3
done
