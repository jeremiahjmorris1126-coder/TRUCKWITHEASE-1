export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;  // Consecutive failures before tripping (default: 3)
  resetTimeoutMs?: number;    // Milliseconds in OPEN state before testing recovery (default: 30000ms)
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures: number = 0;
  private tripsCount: number = 0;
  private nextAttemptTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(public readonly name: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
  }

  public canExecute(): boolean {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.tripsCount++;
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    }
  }

  public resetForTesting(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.tripsCount = 0;
    this.nextAttemptTime = 0;
  }

  public getStatus(): { state: CircuitState; consecutiveFailures: number; tripsCount: number } {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      tripsCount: this.tripsCount,
    };
  }
}
