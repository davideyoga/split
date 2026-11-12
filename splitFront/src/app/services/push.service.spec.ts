import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';

import { environment } from '../../environments/environment';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';

const BASE = `${environment.apiUrl}/notification/push`;
const OWNER_KEY = 'split.pushOwner';
const ME: User = { publicId: 'me', nickName: 'Pippo', email: 'pippo@disney.test' };

function fakeSubscription(endpoint: string): PushSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'P', auth: 'A' } }),
  } as unknown as PushSubscription;
}

// SwPush con il service worker "acceso", senza browser.
class FakeSwPush {
  isEnabled = true;
  current = new BehaviorSubject<PushSubscription | null>(null);
  subscription = this.current.asObservable();
  notificationClicks = new Subject<{ action: string; notification: NotificationOptions & { title: string } }>();
  messages = new Subject<object>();
  pushSubscriptionChanges = new Subject<{
    oldSubscription: PushSubscription | null;
    newSubscription: PushSubscription | null;
  }>();
  requestSubscription = jest.fn(async () => {
    const subscription = fakeSubscription('https://fcm.googleapis.com/fcm/send/new');
    this.current.next(subscription);
    return subscription;
  });
  unsubscribe = jest.fn(async () => {
    if (!this.current.value) {
      throw new Error('Not subscribed to push notifications.');
    }
    this.current.next(null);
  });
}

// Lascia finire le promesse e i timer a zero in coda.
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('PushService', () => {
  let swPush: FakeSwPush;
  let http: HttpTestingController;
  let currentUser: ReturnType<typeof signal<User | null>>;
  let lang: ReturnType<typeof signal<'it' | 'en'>>;
  let navigateByUrl: jest.Mock;
  let refreshCount: jest.Mock;
  let permission: NotificationPermission;

  function setup(options: { user?: User | null; subscription?: PushSubscription | null; owner?: string } = {}) {
    localStorage.clear();
    if (options.owner) {
      localStorage.setItem(OWNER_KEY, options.owner);
    }
    swPush = new FakeSwPush();
    swPush.current.next(options.subscription ?? null);
    currentUser = signal<User | null>(options.user === undefined ? ME : options.user);
    lang = signal<'it' | 'en'>('it');
    navigateByUrl = jest.fn().mockResolvedValue(true);
    refreshCount = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SwPush, useValue: swPush },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: AuthService, useValue: { currentUser } },
        { provide: LanguageService, useValue: { current: lang } },
        { provide: NotificationService, useValue: { refreshCount } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(PushService);
    service.init();
    TestBed.tick();
    return service;
  }

  async function answerConfig(vapidPublicKey: string | null) {
    http.expectOne(`${BASE}/config`).flush({ vapidPublicKey });
    await settle();
    await settle();
  }

  beforeEach(() => {
    permission = 'default';
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { get permission() { return permission; } },
    });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('senza chiave sul server le push non ci sono', async () => {
    const service = setup();
    await answerConfig(null);
    expect(service.state()).toBe('unavailable');
  });

  it('permesso negato nel browser: "denied", niente interruttore', async () => {
    permission = 'denied';
    const service = setup();
    await answerConfig('KEY');
    expect(service.state()).toBe('denied');
  });

  it('accendere: iscrive il browser con la chiave del server e manda iscrizione e lingua', async () => {
    const service = setup();
    await answerConfig('KEY');
    expect(service.state()).toBe('off');

    const done = service.enable();
    await settle();
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'KEY' });
    const request = http.expectOne(`${BASE}/subscribe`);
    expect(request.request.body).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/new',
      keys: { p256dh: 'P', auth: 'A' },
      locale: 'it',
    });
    request.flush(null);
    await done;

    expect(service.state()).toBe('on');
    expect(localStorage.getItem(OWNER_KEY)).toBe('me');
  });

  it('se il server non salva l\'iscrizione, il browser non resta iscritto', async () => {
    const service = setup();
    await answerConfig('KEY');

    const done = service.enable();
    await settle();
    http.expectOne(`${BASE}/subscribe`).flush('no', { status: 500, statusText: 'Server Error' });
    await expect(done).rejects.toBeTruthy();

    expect(swPush.unsubscribe).toHaveBeenCalled();
    expect(service.state()).toBe('off');
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
  });

  it('all\'avvio un\'iscrizione propria resta accesa e si rimanda al server', async () => {
    const mine = fakeSubscription('https://fcm.googleapis.com/fcm/send/mine');
    const service = setup({ subscription: mine, owner: 'me' });
    await answerConfig('KEY');

    expect(service.state()).toBe('on');
    expect(http.expectOne(`${BASE}/subscribe`).request.body.endpoint).toBe(mine.endpoint);
  });

  it('all\'avvio un\'iscrizione rimasta di un altro utente si toglie', async () => {
    const theirs = fakeSubscription('https://fcm.googleapis.com/fcm/send/theirs');
    const service = setup({ subscription: theirs, owner: 'someone-else' });
    await answerConfig('KEY');

    expect(swPush.unsubscribe).toHaveBeenCalled();
    expect(service.state()).toBe('off');
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
  });

  it('al logout il browser smette di ricevere le push', async () => {
    const mine = fakeSubscription('https://fcm.googleapis.com/fcm/send/mine');
    const service = setup({ subscription: mine, owner: 'me' });
    await answerConfig('KEY');
    http.expectOne(`${BASE}/subscribe`).flush(null);

    // Dal Profilo, prima del signOut: toglie il dispositivo dal server.
    service.forgetDevice();
    expect(http.expectOne(`${BASE}/unsubscribe`).request.body).toEqual({ endpoint: mine.endpoint });

    currentUser.set(null);
    TestBed.tick();
    await settle();
    expect(swPush.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
    expect(service.state()).toBe('loading');
  });

  it('cambiando lingua con le push accese, il server riceve la nuova', async () => {
    const mine = fakeSubscription('https://fcm.googleapis.com/fcm/send/mine');
    setup({ subscription: mine, owner: 'me' });
    await answerConfig('KEY');
    http.expectOne(`${BASE}/subscribe`).flush(null);

    lang.set('en');
    TestBed.tick();
    await settle();
    expect(http.expectOne(`${BASE}/subscribe`).request.body.locale).toBe('en');
  });

  it('tocco su una notifica: apre la pagina, ma solo un percorso dell\'app', async () => {
    setup({ user: null });
    swPush.notificationClicks.next({
      action: '',
      notification: { title: 'Split', data: { url: '/tabs/balances' } },
    });
    swPush.notificationClicks.next({
      action: '',
      notification: { title: 'Split', data: { url: 'https://evil.example/' } },
    });
    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/tabs/balances');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/tabs/activity');
  });

  it('una push arrivata con l\'app aperta aggiorna la campanella', () => {
    setup({ user: null });
    swPush.messages.next({ notification: { title: 'Split' } });
    expect(refreshCount).toHaveBeenCalled();
  });
});
