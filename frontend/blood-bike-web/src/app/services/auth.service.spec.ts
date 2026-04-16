import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, MeResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  // ---- initial state ----

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should start logged out when localStorage is empty', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  it('should start logged in when token exists in localStorage', () => {
    TestBed.resetTestingModule();
    localStorage.setItem('bb_id_token', 'tok');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });
    const svc = TestBed.inject(AuthService);
    expect(svc.isLoggedIn()).toBe(true);
    // re-setup for afterEach
    http = TestBed.inject(HttpTestingController);
  });

  // ---- hasRole ----

  it('hasRole returns false when no user', () => {
    expect(service.hasRole('Admin')).toBe(false);
  });

  it('hasRole returns true when user has the role', () => {
    service.user.set({ sub: 'u1', roles: ['Admin', 'Rider'] });
    expect(service.hasRole('Admin')).toBe(true);
    expect(service.hasRole('Rider')).toBe(true);
  });

  it('hasRole returns false for a role the user does not have', () => {
    service.user.set({ sub: 'u1', roles: ['Rider'] });
    expect(service.hasRole('Admin')).toBe(false);
  });

  // ---- signIn ----

  it('should store tokens and set loggedIn on successful sign-in', fakeAsync(() => {
    let result: boolean | undefined;
    service.signIn({ username: 'admin', password: 'pass' }).subscribe(r => (result = r));

    const req = http.expectOne('/api/auth/signin');
    expect(req.request.method).toBe('POST');
    req.flush({ accessToken: 'acc', idToken: 'id', refreshToken: 'ref' });
    tick();

    expect(result).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('bb_access_token')).toBe('acc');
    expect(localStorage.getItem('bb_id_token')).toBe('id');
  }));

  it('should set lastAuthError on sign-in failure', fakeAsync(() => {
    service.signIn({ username: 'x', password: 'y' }).subscribe({
      error: () => {},
    });
    const req = http.expectOne('/api/auth/signin');
    req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(service.lastAuthError()).toBeTruthy();
    expect(service.isLoggedIn()).toBe(false);
  }));

  // ---- logout ----

  it('logout clears tokens and resets state', () => {
    localStorage.setItem('bb_access_token', 'acc');
    localStorage.setItem('bb_id_token', 'id');
    service.user.set({ sub: 'u1', roles: ['Admin'] });

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.user()).toBeNull();
    expect(localStorage.getItem('bb_access_token')).toBeNull();
    expect(localStorage.getItem('bb_id_token')).toBeNull();
  });

  // ---- fetchMe ----

  it('fetchMe returns null when no token stored', fakeAsync(() => {
    let result: any = 'initial';
    service.fetchMe().subscribe(r => (result = r));
    tick();
    expect(result).toBeNull();
  }));

  it('fetchMe updates user signal on success', fakeAsync(() => {
    localStorage.setItem('bb_id_token', 'tok');
    const me: MeResponse = { sub: 's1', username: 'alice', roles: ['Rider'] };

    service.fetchMe().subscribe();
    const req = http.expectOne('/api/me');
    req.flush(me);
    tick();

    expect(service.user()).toEqual(me);
    expect(service.roles()).toEqual(['Rider']);
  }));

  it('fetchMe calls logout on 401', fakeAsync(() => {
    localStorage.setItem('bb_id_token', 'expired');

    service.fetchMe().subscribe();
    const req = http.expectOne('/api/me');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.user()).toBeNull();
  }));

  // ---- signUp ----

  it('signUp sends POST to /api/auth/signup', fakeAsync(() => {
    let result: any;
    service.signUp({ username: 'u', password: 'p', email: 'e@e.com' }).subscribe(r => (result = r));
    const req = http.expectOne('/api/auth/signup');
    expect(req.request.method).toBe('POST');
    req.flush({});
    tick();
    expect(result).toBe(true);
  }));

  // ---- getAccessToken / getIdToken ----

  it('getAccessToken returns null when not set', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('getIdToken returns token from localStorage', () => {
    localStorage.setItem('bb_id_token', 'mytoken');
    expect(service.getIdToken()).toBe('mytoken');
  });
});
