export class PromptlianoError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends PromptlianoError {
  constructor(message: string, public editor?: string) {
    super(message, 'CONFIG_ERROR');
  }
}

export class InstallationError extends PromptlianoError {
  constructor(message: string, public installPath?: string) {
    super(message, 'INSTALL_ERROR');
  }
}

export class ServerError extends PromptlianoError {
  constructor(message: string, public port?: number) {
    super(message, 'SERVER_ERROR');
  }
}

export class PermissionError extends PromptlianoError {
  constructor(message: string, public path?: string) {
    super(message, 'PERMISSION_ERROR');
  }
}

export class ValidationError extends PromptlianoError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}