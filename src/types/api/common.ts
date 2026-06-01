export interface ErrorInfo {
  name: string
  data: unknown
}

export interface ProviderAuthError {
  name: 'ProviderAuthError'
  data: {
    providerID: string
    error: string
  }
}

export interface UnknownError {
  name: 'UnknownError'
  data: {
    message: string
  }
}

export interface MessageOutputLengthError {
  name: 'MessageOutputLengthError'
  data: {
    message: string
  }
}

export interface MessageAbortedError {
  name: 'MessageAbortedError'
  data?: unknown
}

export type APIError =
  | ProviderAuthError
  | UnknownError
  | MessageOutputLengthError
  | MessageAbortedError
