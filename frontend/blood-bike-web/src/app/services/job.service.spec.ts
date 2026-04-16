import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { JobService } from './job.service';
import { AuthService } from './auth.service';
import { Job } from '../models/job.model';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  jobId: 'job-1',
  title: 'Test Job',
  status: 'open',
  createdBy: 'admin',
  acceptedBy: '',
  pickup: { address: 'Galway' },
  dropoff: { address: 'Limerick' },
  timestamps: {},
  ...overrides,
});

const makeAuthMock = (user = 'rider1') => ({
  username: jest.fn().mockReturnValue(user),
});

describe('JobService', () => {
  let service: JobService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        JobService,
        { provide: AuthService, useValue: makeAuthMock('rider1') },
      ],
    });
    service = TestBed.inject(JobService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('starts with empty jobs, not loading, no error', () => {
    expect(service.jobs()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  // ---- loadJobs ----

  it('loadJobs populates jobs signal', fakeAsync(() => {
    const jobs = [makeJob(), makeJob({ jobId: 'job-2', title: 'Second' })];
    service.loadJobs();
    const req = http.expectOne('/api/jobs');
    expect(req.request.method).toBe('GET');
    req.flush(jobs);
    tick();
    expect(service.jobs().length).toBe(2);
    expect(service.loading()).toBe(false);
  }));

  it('loadJobs sets error signal on 500', fakeAsync(() => {
    service.loadJobs();
    http.expectOne('/api/jobs').flush('error', { status: 500, statusText: 'Server Error' });
    tick();
    expect(service.error()).toBeTruthy();
    expect(service.jobs()).toEqual([]);
  }));

  // ---- computed signals ----

  it('openJobs filters to open status', () => {
    service['_jobs'].set([
      makeJob({ jobId: '1', status: 'open' }),
      makeJob({ jobId: '2', status: 'accepted' }),
      makeJob({ jobId: '3', status: 'open' }),
    ]);
    expect(service.openJobs().length).toBe(2);
  });

  it('myActiveJob returns job accepted by current user', () => {
    service['_jobs'].set([
      makeJob({ jobId: '1', status: 'accepted', acceptedBy: 'rider1' }),
      makeJob({ jobId: '2', status: 'open' }),
    ]);
    expect(service.myActiveJob()?.jobId).toBe('1');
  });

  it('myActiveJob returns null when rider has no active job', () => {
    service['_jobs'].set([makeJob({ jobId: '1', status: 'open' })]);
    expect(service.myActiveJob()).toBeNull();
  });

  it('myJobs returns non-open jobs for current user', () => {
    service['_jobs'].set([
      makeJob({ jobId: '1', status: 'delivered', acceptedBy: 'rider1' }),
      makeJob({ jobId: '2', status: 'open' }),
      makeJob({ jobId: '3', status: 'completed', acceptedBy: 'rider1' }),
    ]);
    expect(service.myJobs().length).toBe(2);
  });

  // ---- acceptJob ----

  it('acceptJob sends PUT and updates job in signal', async () => {
    const job = makeJob();
    service['_jobs'].set([job]);

    const accepted = makeJob({ status: 'accepted', acceptedBy: 'rider1' });
    const promise = service.acceptJob(job);
    http.expectOne('/api/jobs/job-1').flush(accepted);

    const result = await promise;
    expect(result.status).toBe('accepted');
    expect(service.jobs()[0].status).toBe('accepted');
  });

  it('acceptJob rejects on error', async () => {
    const job = makeJob();
    service['_jobs'].set([job]);
    const promise = service.acceptJob(job);
    http.expectOne('/api/jobs/job-1').flush('err', { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toBeTruthy();
  });

  // ---- updateJobStatus ----

  it('updateJobStatus sends PUT and updates status', async () => {
    const job = makeJob({ status: 'accepted', acceptedBy: 'rider1' });
    service['_jobs'].set([job]);

    const pickedUp = makeJob({ status: 'picked-up', acceptedBy: 'rider1' });
    const promise = service.updateJobStatus('job-1', 'picked-up');
    http.expectOne('/api/jobs/job-1').flush(pickedUp);

    const result = await promise;
    expect(result.status).toBe('picked-up');
    expect(service.jobs()[0].status).toBe('picked-up');
  });

  // ---- sendReceipt ----

  it('sendReceipt posts to /api/jobs/receipt', async () => {
    const request = {
      jobId: 'job-1', type: 'delivery' as const, recipientEmail: 'x@x.com',
      riderName: 'Rider', signatureData: 'data:image/png;base64,abc',
      jobTitle: 'Test', pickupAddress: 'A', dropoffAddress: 'B',
      timestamp: '2024-01-01T00:00:00Z', dispatcherName: 'Dispatch',
    };
    const promise = service.sendReceipt(request);
    const req = http.expectOne('/api/jobs/receipt');
    expect(req.request.method).toBe('POST');
    req.flush({ sent: true, message: 'ok' });
    const res = await promise;
    expect(res.sent).toBe(true);
  });

  // ---- saved contacts (localStorage) ----

  it('getSavedContacts returns empty array initially', () => {
    expect(service.getSavedContacts()).toEqual([]);
  });

  it('saveContact stores contact', () => {
    service.saveContact({ name: 'Alice', email: 'alice@test.com' });
    const contacts = service.getSavedContacts();
    expect(contacts.length).toBe(1);
    expect(contacts[0].name).toBe('Alice');
  });

  it('saveContact updates existing contact by email', () => {
    service.saveContact({ name: 'Alice', email: 'alice@test.com' });
    service.saveContact({ name: 'Alice Updated', email: 'alice@test.com' });
    const contacts = service.getSavedContacts();
    expect(contacts.length).toBe(1);
    expect(contacts[0].name).toBe('Alice Updated');
  });

  it('removeContact removes by email', () => {
    service.saveContact({ name: 'Alice', email: 'a@a.com' });
    service.saveContact({ name: 'Bob', email: 'b@b.com' });
    service.removeContact('a@a.com');
    const contacts = service.getSavedContacts();
    expect(contacts.length).toBe(1);
    expect(contacts[0].name).toBe('Bob');
  });
});
