import * as log4js from 'log4js';

const logger = log4js.getLogger();
logger.level = 'info';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export { logger, getErrorMessage };
