import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getIdToken() || auth.getAccessToken();
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('/api/');

  console.log(`[authInterceptor] URL: ${req.url}, isApiRequest: ${isApiRequest}, hasToken: ${!!token}`);

  if (!isApiRequest) {
    return next(req);
  }

  if (!token) {
    console.warn(`[authInterceptor] API request but NO TOKEN for: ${req.url}`);
    return next(req);
  }

  console.log(`[authInterceptor] ✓ Adding token (${token.substring(0, 30)}...) to ${req.method} ${req.url}`);
  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    })
  );
};
