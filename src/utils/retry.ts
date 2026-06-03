import type { RetryConfig } from '../types'

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt >= config.maxRetries) break
      await new Promise((resolve) =>
        setTimeout(resolve, config.retryDelay * 2 ** attempt),
      )
    }
  }

  throw lastError
}
