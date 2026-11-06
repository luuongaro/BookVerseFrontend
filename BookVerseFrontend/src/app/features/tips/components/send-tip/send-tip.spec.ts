import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CHECKOUT_REDIRECT, SendTip } from './send-tip';
import { API_URL } from '../../../../core/api/api.config';

describe('Supporting an author through the existing story checkout', () => {
  function setup() {
    const redirect = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CHECKOUT_REDIRECT, useValue: redirect },
      ],
    });
    const fixture = TestBed.createComponent(SendTip);
    fixture.componentRef.setInput('storyId', 'published-story');
    fixture.componentRef.setInput('recipientName', 'Marina');
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      redirect,
      http: TestBed.inject(HttpTestingController),
    };
  }
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('creates one checkout for the selected author story and redirects to its HTTPS payment page', () => {
    const { component, http, redirect } = setup();
    component.send();
    component.send();
    const request = http.expectOne(`${API_URL}/tips`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      storyId: 'published-story',
      amount: 1000,
      message: 'Apoyo para Marina',
    });
    request.flush({ checkout: { checkoutUrl: 'https://www.mercadopago.com.ar/checkout/test' } });
    expect(redirect).toHaveBeenCalledExactlyOnceWith(
      'https://www.mercadopago.com.ar/checkout/test',
    );
  });

  it('keeps the user on the profile on failure and allows retrying', () => {
    const { component, http, redirect } = setup();
    component.send();
    http.expectOne(`${API_URL}/tips`).flush({}, { status: 500, statusText: 'Unavailable' });
    expect(component.pending()).toBe(false);
    expect(component.error()).not.toBe('');
    expect(redirect).not.toHaveBeenCalled();
    component.send();
    http.expectOne(`${API_URL}/tips`).flush({ checkout: { checkoutUrl: 'javascript:alert(1)' } });
    expect(redirect).not.toHaveBeenCalled();
    expect(component.error()).toContain('No pudimos abrir');
  });
});
