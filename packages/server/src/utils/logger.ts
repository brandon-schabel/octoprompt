type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LoggerConfig = {
    minLevel: LogLevel;
    levels: Record<LogLevel, number>;
};

const config: LoggerConfig = {
    minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    }
};

const formatMessage = (level: LogLevel, message: string, ...args: unknown[]): string => {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
        arg instanceof Error ? arg.stack : JSON.stringify(arg)
    ).join(' ');
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${formattedArgs}`;
};

export const logger = {
    debug(message: string, ...args: unknown[]): void {
        if (config.levels[config.minLevel] <= config.levels.debug) {
            console.debug(formatMessage('debug', message, ...args));
        }
    },

    info(message: string, ...args: unknown[]): void {
        if (config.levels[config.minLevel] <= config.levels.info) {
            console.info(formatMessage('info', message, ...args));
        }
    },

    warn(message: string, ...args: unknown[]): void {
        if (config.levels[config.minLevel] <= config.levels.warn) {
            console.warn(formatMessage('warn', message, ...args));
        }
    },

    error(message: string, ...args: unknown[]): void {
        if (config.levels[config.minLevel] <= config.levels.error) {
            console.error(formatMessage('error', message, ...args));
        }
    }
}; 