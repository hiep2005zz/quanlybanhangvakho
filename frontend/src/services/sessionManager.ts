// frontend/src/services/sessionManager.ts
import { refreshTokenApi, notifySessionExpired, AUTH_STORAGE, validateSessionApi } from './api';

// Định danh duy nhất cho từng Tab/Cửa sổ để phân biệt tab thao tác với các tab khác
export const CURRENT_TAB_ID = 'tab_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

// Cấu hình thời gian
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút không tương tác -> hết hạn phiên
const WARNING_THRESHOLD_SECONDS = 120; // 2 phút (Vùng cảnh báo)
const CHECK_INTERVAL_MS = 1000; // Chạy setInterval mỗi 1000ms (1s)

export interface SessionState {
  isActive: boolean;
  remainingSeconds: number;
  expiresAt: number;
  isWarning: boolean; // remainingSeconds <= 120s
  lastActivity: number;
  lastRefreshed: number;
  isRefreshing: boolean;
}

type TokenRefreshListener = (newToken: string) => void;
type StatusListener = (state: SessionState) => void;

class SessionManager {
  private lastActivityTime: number = Date.now();
  private lastRefreshedTime: number = Date.now();
  private checkTimer: number | null = null;
  private currentToken: string | null = null;
  private isRefreshing: boolean = false;
  private lastSilentRefreshTrigger: number = 0;
  private tokenRefreshListeners: Set<TokenRefreshListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isInitialized: boolean = false;
  private heartbeatCounter: number = 0;
  private authChannel: BroadcastChannel | null = null;

  constructor() {
    this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 2000);
    this.handleUserInteraction = this.throttle(this.handleUserInteraction.bind(this), 1000);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleStorage = this.handleStorage.bind(this);
  }

  private throttle(fn: () => void, wait: number) {
    let lastTime = 0;
    return () => {
      const now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn();
      }
    };
  }

  // Cập nhật hoạt động thụ động (di chuột)
  private handleMouseMove() {
    this.lastActivityTime = Date.now();
  }

  // Cập nhật thao tác chủ động (gõ phím, click chuột, gửi form)
  public handleUserInteraction() {
    this.lastActivityTime = Date.now();

    // Nếu người dùng chủ động thao tác khi thời gian còn dưới 2 phút (<= 120s):
    // Tự động kích hoạt Silent Refresh ngầm để bảo toàn phiên và dữ liệu
    const state = this.getSessionState();
    if (state.remainingSeconds > 0 && state.remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
      const now = Date.now();
      if (now - this.lastSilentRefreshTrigger > 3000 && !this.isRefreshing) {
        this.lastSilentRefreshTrigger = now;
        this.performSilentRefresh();
      }
    }
  }

  public recordActivity() {
    this.handleUserInteraction();
  }

  private handleOnline() {
    // Khi mạng có lại, lập tức thử làm mới phiên nếu token sắp hết hạn
    if (this.currentToken && !this.isRefreshing) {
      this.checkAndRefreshSession(true);
    }
  }

  // Lắng nghe sự kiện chuyển tab / focus lại cửa sổ:
  // Lập tức kiểm tra tính hợp lệ của Token với server (thu hồi tức thì nếu tab khác đã đổi mật khẩu)
  private handleWindowFocus() {
    if (this.currentToken && !this.isRefreshing) {
      validateSessionApi(this.currentToken);
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.currentToken && !this.isRefreshing) {
      validateSessionApi(this.currentToken);
    }
  }

  // Lắng nghe sự kiện storage trên các tab cùng trình duyệt:
  private handleStorage(e: StorageEvent) {
    if (e.key === AUTH_STORAGE.TOKEN) {
      if (!e.newValue) {
        // Tab khác đã đăng xuất
        this.forceExpire('Bạn đã đăng xuất từ một cửa sổ khác.');
      } else if (this.currentToken && e.newValue !== this.currentToken) {
        // Tab khác đã đổi mật khẩu và cấp token mới -> token tab này bị thu hồi
        this.forceExpire('Phiên làm việc đã bị thu hồi do đổi mật khẩu từ một cửa sổ khác. Vui lòng đăng nhập lại.');
      }
    }
  }

  public start(token: string) {
    this.currentToken = token;
    this.lastActivityTime = Date.now();
    this.lastRefreshedTime = Date.now();
    this.heartbeatCounter = 0;

    // Thiết lập BroadcastChannel để đồng bộ tức thì 0ms giữa các tab
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        if (this.authChannel) {
          this.authChannel.close();
        }
        this.authChannel = new BroadcastChannel('auth_channel');
        this.authChannel.onmessage = (event) => {
          // Bỏ qua tin nhắn do chính tab này gửi để không tự đá văng chính mình
          if (event.data?.tabId === CURRENT_TAB_ID) {
            return;
          }

          if (event.data?.type === 'PASSWORD_CHANGED') {
            // Nếu tab này đã cập nhật token mới rồi thì không thu hồi
            if (this.currentToken && event.data?.newToken === this.currentToken) {
              return;
            }
            this.forceExpire('Phiên làm việc đã bị thu hồi do đổi mật khẩu từ một cửa sổ khác. Vui lòng đăng nhập lại.');
          } else if (event.data?.type === 'LOGOUT') {
            this.forceExpire('Bạn đã đăng xuất từ một cửa sổ khác.');
          }
        };
      } catch {
        // ignore
      }
    }

    if (!this.isInitialized) {
      window.addEventListener('mousemove', this.handleUserInteraction);
      window.addEventListener('mousedown', this.handleUserInteraction);
      window.addEventListener('keydown', this.handleUserInteraction);
      window.addEventListener('click', this.handleUserInteraction);
      window.addEventListener('touchstart', this.handleUserInteraction);
      window.addEventListener('scroll', this.handleUserInteraction);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('focus', this.handleWindowFocus);
      window.addEventListener('storage', this.handleStorage);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.isInitialized = true;
    }

    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
    }

    // Interval chạy mỗi 1000ms tính thời gian còn lại & Heartbeat kiểm tra token định kỳ
    this.checkTimer = window.setInterval(() => {
      this.checkAndRefreshSession(false);
      this.notifyStatus();

      // Heartbeat mỗi 10 giây: Ping server kiểm tra hiệu lực token (Realtime Revocation)
      this.heartbeatCounter++;
      if (this.heartbeatCounter >= 10) {
        this.heartbeatCounter = 0;
        if (this.currentToken && !this.isRefreshing) {
          validateSessionApi(this.currentToken);
        }
      }
    }, CHECK_INTERVAL_MS);

    this.notifyStatus();
  }

  public stop() {
    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.currentToken = null;

    if (this.authChannel) {
      try {
        this.authChannel.close();
      } catch {
        // ignore
      }
      this.authChannel = null;
    }

    if (this.isInitialized) {
      window.removeEventListener('mousemove', this.handleUserInteraction);
      window.removeEventListener('mousedown', this.handleUserInteraction);
      window.removeEventListener('keydown', this.handleUserInteraction);
      window.removeEventListener('click', this.handleUserInteraction);
      window.removeEventListener('touchstart', this.handleUserInteraction);
      window.removeEventListener('scroll', this.handleUserInteraction);
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('storage', this.handleStorage);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.isInitialized = false;
    }
  }

  public onTokenRefreshed(listener: TokenRefreshListener): () => void {
    this.tokenRefreshListeners.add(listener);
    return () => {
      this.tokenRefreshListeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getSessionState(): SessionState {
    const expiresAtStr = localStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const now = Date.now();
    // Logic tính toán: const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const idleMs = now - this.lastActivityTime;
    const isActive = idleMs < INACTIVITY_TIMEOUT_MS;
    const isWarning = remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD_SECONDS;

    return {
      isActive,
      remainingSeconds,
      expiresAt,
      isWarning,
      lastActivity: this.lastActivityTime,
      lastRefreshed: this.lastRefreshedTime,
      isRefreshing: this.isRefreshing,
    };
  }

  private notifyStatus() {
    const state = this.getSessionState();
    this.statusListeners.forEach((listener) => listener(state));
  }

  public async forceRefresh(): Promise<boolean> {
    if (this.currentToken) {
      return await this.performSilentRefresh();
    }
    return false;
  }

  public forceExpire(message: string = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.') {
    this.stop();
    notifySessionExpired(message);
  }

  private async checkAndRefreshSession(forceCheck: boolean = false) {
    if (!this.currentToken || this.isRefreshing) return;

    const expiresAtStr = localStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const idleMs = now - this.lastActivityTime;

    // 1. Kiểm tra hết hạn do không tương tác (Idle Timeout)
    if (idleMs >= INACTIVITY_TIMEOUT_MS) {
      this.forceExpire();
      return;
    }

    // 2. Khi remainingSeconds = 0: Xóa sạch token, đưa về trang /login kèm thông báo
    if (remainingSeconds <= 0) {
      this.forceExpire();
      return;
    }

    // 3. Nếu forceCheck (ví dụ: mạng vừa online trở lại) và token sắp hết hạn
    if (forceCheck && remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
      await this.performSilentRefresh();
    }
  }

  private async performSilentRefresh(): Promise<boolean> {
    if (!this.currentToken || this.isRefreshing) return false;

    this.isRefreshing = true;
    this.notifyStatus();

    try {
      const data = await refreshTokenApi(this.currentToken);
      this.currentToken = data.access_token;
      this.lastRefreshedTime = Date.now();
      this.lastActivityTime = Date.now();

      // Thông báo cho App và các component cập nhật token mới
      this.tokenRefreshListeners.forEach((listener) => listener(data.access_token));
      return true;
    } catch (err: any) {
      console.warn('Silent refresh không thành công:', err);
      return false;
    } finally {
      this.isRefreshing = false;
      this.notifyStatus();
    }
  }
}

export const sessionManager = new SessionManager();
