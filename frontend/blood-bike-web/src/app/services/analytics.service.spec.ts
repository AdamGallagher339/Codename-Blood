import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService, RiderSummary, RiderOption } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AnalyticsService],
    });
    service = TestBed.inject(AnalyticsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ---- getSummary ----

  it('getSummary fetches /api/analytics/:riderId', fakeAsync(() => {
    const summary: RiderSummary = {
      riderId: 'r1',
      topSpeedKph: 80,
      avgSpeedKph: 45,
      totalDistanceKm: 12.5,
      activeTimeMinutes: 30,
      currentSpeedKph: 0,
      lastLat: 53.27,
      lastLng: -9.05,
      lastSeen: '2024-01-01T00:00:00Z',
      speedHistory: [{ timestamp: '2024-01-01T00:00:00Z', speed: 40, lat: 53.27, lng: -9.05 }],
      dataPoints: 10,
    };

    let result: RiderSummary | undefined;
    service.getSummary('r1').subscribe(r => (result = r));

    const req = http.expectOne('/api/analytics/r1');
    expect(req.request.method).toBe('GET');
    req.flush(summary);
    tick();

    expect(result).toEqual(summary);
    expect(result!.riderId).toBe('r1');
  }));

  it('getSummary propagates HTTP errors', fakeAsync(() => {
    let error: any;
    service.getSummary('bad').subscribe({ error: e => (error = e) });

    http.expectOne('/api/analytics/bad').flush('not found', { status: 404, statusText: 'Not Found' });
    tick();

    expect(error).toBeTruthy();
    expect(error.status).toBe(404);
  }));

  // ---- getRiders ----

  it('getRiders maps availability response to RiderOption[]', fakeAsync(() => {
    let result: RiderOption[] | undefined;
    service.getRiders().subscribe(r => (result = r));

    const req = http.expectOne('/api/riders/availability');
    expect(req.request.method).toBe('GET');
    req.flush([
      { riderId: 'r1', name: 'Alice' },
      { riderId: 'r2' },
    ]);
    tick();

    expect(result!.length).toBe(2);
    expect(result![0]).toEqual({ id: 'r1', name: 'Alice' });
    expect(result![1]).toEqual({ id: 'r2', name: 'r2' }); // fallback to riderId
  }));

  it('getRiders returns empty array for empty response', fakeAsync(() => {
    let result: RiderOption[] | undefined;
    service.getRiders().subscribe(r => (result = r));
    http.expectOne('/api/riders/availability').flush([]);
    tick();
    expect(result).toEqual([]);
  }));
});
