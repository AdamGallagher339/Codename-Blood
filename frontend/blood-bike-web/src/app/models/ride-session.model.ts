export interface RideSession {
  sessionId: string;
  bikeId: string;
  riderId: string;
  depot: string;
  startTime: Date;
  endTime: Date;
  startMiles: number;
  endMiles: number;
}

export interface CreateRideSessionDto {
  bikeId: string;
  riderId: string;
  depot: string;
  startMiles: number;
}

export interface EndRideSessionDto {
  endMiles: number;
}
