// frontend/src/services/sessionManager.ts
import { refreshTokenApi, notifySessionExpired, AUTH_STORAGE } from './api';

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

  constructor() {
    this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 2000);
    this.handleUserInteraction = this.throttle(this.handleUserInteraction.bind(this), 1000);
    this.handleOnline = this.handleOnline.bind(this);
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

  public start(token: string) {
    this.currentToken = token;
    this.lastActivityTime = Date.now();
    this.lastRefreshedTime = Date.now();

    if (!this.isInitialized) {
      window.addEventListener('mousemove', this.handleUserInteraction);
      window.addEventListener('mousedown', this.handleUserInteraction);
      window.addEventListener('keydown', this.handleUserInteraction);
      window.addEventListener('click', this.handleUserInteraction);
      window.addEventListener('touchstart', this.handleUserInteraction);
      window.addEventListener('scroll', this.handleUserInteraction);
      window.addEventListener('online', this.handleOnline);
      this.isInitialized = true;
    }

    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
    }

    // Interval chạy mỗi 1000ms tính thời gian còn lại
    this.checkTimer = window.setInterval(() => {
      this.checkAndRefreshSession(false);
      this.notifyStatus();
    }, CHECK_INTERVAL_MS);

    this.notifyStatus();
  }

  public stop() {
    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.currentToken = null;

    if (this.isInitialized) {
      window.removeEventListener('mousemove', this.handleUserInteraction);
      window.removeEventListener('mousedown', this.handleUserInteraction);
      window.removeEventListener('keydown', this.handleUserInteraction);
      window.removeEventListener('click', this.handleUserInteraction);
      window.removeEventListener('touchstart', this.handleUserInteraction);
      window.removeEventListener('scroll', this.handleUserInteraction);
      window.removeEventListener('online', this.handleOnline);
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

  public forceExpire() {
    this.stop();
    notifySessionExpired('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
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
