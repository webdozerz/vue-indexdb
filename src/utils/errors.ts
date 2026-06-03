export class IDBError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'IDBError'
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SyncError'
  }
}
