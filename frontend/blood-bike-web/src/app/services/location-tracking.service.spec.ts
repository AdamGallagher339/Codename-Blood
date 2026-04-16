import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LocationTrackingService } from './location-tracking.service';
import { LocationUpdate } from '../models/location.model';

const makeLoc = (overrides: Partial<LocationUpdate> = {}): LocationUpdate => ({
  entityId: 'rider-1',
  entityType: 'rider',
  latitude: 53.2707,
  longitude: -9.0568,
  timestamp: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('LocationTrackingService', () => {
  let service: LocationTrackingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LocationTrackingService],
    });
    service = TestBed.inject(LocationTrackingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.disconnectWebSocket();
    service.stopRidersPolling();
    http.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ---- isLocationStale ----

  it('isLocationStale returns false for recent location', () => {
    const loc = makeLoc({ updatedAt: new Date().toISOString() });
    expect(service.isLocationStale(loc)).toBe(false);
  });

  it('isLocationStale returns true for location older than 5 minutes', () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const loc = makeLoc({ updatedAt: old });
    expect(service.isLocationStale(loc)).toBe(true);
  });

  it('isLocationStale returns false for location exactly 4 minutes old', () => {
    const recent = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    const loc = makeLoc({ updatedAt: recent });
    expect(service.isLocationStale(loc)).toBe(false);
  });

  // ---- HTTP helpers ----

  it('updateLocation posts to /api/tracking/update', fakeAsync(() => {
    let result: any;
    service.updateLocation({ entityId: 'r1', latitude: 53.0, longitude: -9.0 }).subscribe(r => (result = r));
    const req = http.expectOne('/api/tracking/update');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
    tick();
    expect(result).toEqual({ ok: true });
  }));

  it('getAllLocations gets /api/tracking/locations', fakeAsync(() => {
    let result: LocationUpdate[] | undefined;
    service.getAllLocations().subscribe(r => (result = r));
    http.expectOne('/api/tracking/locations').flush([makeLoc()]);
    tick();
    expect(result!.length).toBe(1);
  }));

  it('getAllEntities gets /api/tracking/entities', fakeAsync(() => {
    let result: any;
    service.getAllEntities().subscribe(r => (result = r));
    http.expectOne('/api/tracking/entities').flush([]);
    tick();
    expect(result).toEqual([]);
  }));

  it('getRiders gets /api/tracking/riders and returns empty on error', fakeAsync(() => {
    let result: any;
    service.getRiders().subscribe(r => (result = r));
    http.expectOne('/api/tracking/riders').flush('err', { status: 500, statusText: 'Error' });
    tick();
    expect(result).toEqual([]); // catchError returns of([])
  }));

  // ---- sendLocationViaWebSocket distance gate ----

  it('sendLocationViaWebSocket sends first update unconditionally', fakeAsync(() => {
    service.sendLocationViaWebSocket({ entityId: 'r1', latitude: 53.0, longitude: -9.0 });
    const req = http.expectOne('/api/tracking/update');
    req.flush({ ok: true });
    tick();
  }));

  it('sendLocationViaWebSocket skips if rider moved less than 30m', fakeAsync(() => {
    // first update — always sent
    service.sendLocationViaWebSocket({ entityId: 'r1', latitude: 53.0, longitude: -9.0 });
    http.expectOne('/api/tracking/update').flush({ ok: true });
    tick();

    // second update — ~10m away (approx 0.0001 deg lat ≈ 11m)
    service.sendLocationViaWebSocket({ entityId: 'r1', latitude: 53.0001, longitude: -9.0 });
    http.expectNone('/api/tracking/update'); // should be skipped
  }));

  it('sendLocationViaWebSocket sends if rider moved more than 30m', fakeAsync(() => {
    service.sendLocationViaWebSocket({ entityId: 'r1', latitude: 53.0, longitude: -9.0 });
    http.expectOne('/api/tracking/update').flush({ ok: true });
    tick();

    // ~110m away (0.001 deg lat ≈ 111m)
    service.sendLocationViaWebSocket({ entityId: 'r1', latitude: 53.001, longitude: -9.0 });
    const req = http.expectOne('/api/tracking/update');
    req.flush({ ok: true });
    tick();
  }));

  // ---- connection status ----

  it('starts in disconnected status', fakeAsync(() => {
    let status: string | undefined;
    service.getConnectionStatus().subscribe(s => (status = s));
    expect(status).toBe('disconnected');
  }));

  // ---- polling lifecycle ----

  it('connectWebSocket starts polling and sets status to connecting then connected', fakeAsync(() => {
    let status: string | undefined;
    service.getConnectionStatus().subscribe(s => (status = s));

    service.connectWebSocket();
    expect(status).toBe('connecting');

    // first poll fires immediately via startWith(0)
    http.expectOne('/api/tracking/locations').flush([makeLoc()]);
    tick();
    expect(status).toBe('connected');

    service.disconnectWebSocket();
    discardPeriodicTasks();
    expect(status).toBe('disconnected');
  }));

  it('startRidersPolling polls /api/tracking/riders', fakeAsync(() => {
    let locations: LocationUpdate[] | undefined;
    service.getAllLocationsStream().subscribe(l => (locations = l));

    service.startRidersPolling(5000);

    // immediate poll
    http.expectOne('/api/tracking/riders').flush([makeLoc({ entityId: 'r1' })]);
    tick();
    expect(locations!.length).toBe(1);

    service.stopRidersPolling();
    discardPeriodicTasks();
  }));

  it('disconnectWebSocket stops polling and sets disconnected', fakeAsync(() => {
    let status: string | undefined;
    service.getConnectionStatus().subscribe(s => (status = s));

    service.connectWebSocket();
    http.expectOne('/api/tracking/locations').flush([]);
    tick();

    service.disconnectWebSocket();
    discardPeriodicTasks();
    expect(status).toBe('disconnected');
  }));
});
