// Location tracking data models matching backend structures

export interface LocationUpdate {
  entityId: string;
  entityType: 'bike' | 'rider';
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
  updatedAt: string;
}

export interface TrackedEntity {
  entityId: string;
  entityType: 'bike' | 'rider';
  name: string;
  lastLocation?: LocationUpdate;
  isActive: boolean;
  lastUpdateTime: string;
}

export interface WebSocketMessage {
  type: 'initial' | 'update' | 'error';
  location?: LocationUpdate;
  locations?: LocationUpdate[];
  message?: string;
}
