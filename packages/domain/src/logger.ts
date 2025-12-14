import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PostHog } from 'posthog-node';
import { environment } from './environment';

export interface LogMetadata {
  // Known metadata fields
  sessionId?: string;
  userId?: string;
  source?: 'api' | 'worker';
  // API-specific context
  path?: string;
  method?: string;
  url?: string;
  // Worker-specific context
  jobName?: string;
  // Allow any additional properties
  [key: string]: any;
}

interface Logger {
  error(error: Error, metadata?: LogMetadata): void;
  // NOTE: Event logging not currently used, keeping commented for future use
  // /** Event names should be lowercase and use -. ex: "api-call", "rss-sync" */
  // event(event: string, metadata?: LogMetadata): void;
}

class PostHogLogger implements Logger {
  private posthog = new PostHog(environment.posthogPublicKey, {
    host: 'https://eu.i.posthog.com',
    enableExceptionAutocapture: true,
  });

  error(error: Error, metadata?: LogMetadata) {
    const { sessionId, userId, ...rest } = metadata || {};

    const allProps = {
      ...rest,
      $session_id: sessionId,
    };

    this.posthog.captureException(error, userId || 'unknown', allProps);
    console.error(error.message);
  }

  // NOTE: Event logging not currently used, keeping commented for future use
  // event(event: string, metadata?: LogMetadata) {
  //   const { sessionId, userId, ...rest } = metadata || {};
  //
  //   const allProps = {
  //     ...rest,
  //     $session_id: sessionId,
  //   };
  //
  //   this.posthog.capture({
  //     event: event,
  //     distinctId: userId || 'unknown',
  //     properties: allProps,
  //   });
  //   console.info(event);
  // }
}

class FileLogger implements Logger {
  private logDir = './logs/';

  constructor() {
    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  error(error: Error, metadata?: LogMetadata) {
    this.writeToFile({
      timestamp: new Date().toISOString(),
      type: 'error',
      metadata,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }

  // NOTE: Event logging not currently used, keeping commented for future use
  // event(event: string, metadata?: LogMetadata) {
  //   this.writeToFile({
  //     timestamp: new Date().toISOString(),
  //     type: 'event',
  //     metadata,
  //     event,
  //   });
  // }

  private writeToFile(entry: Record<string, any>) {
    const today = new Date().toISOString().split('T')[0];
    const filename = `${today}.log`;
    const logPath = join(this.logDir, filename);
    const logLine = JSON.stringify(entry) + '\n';

    try {
      appendFileSync(logPath, logLine, 'utf8');
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }
  }
}

export const logger: Logger = environment.posthogPublicKey ? new PostHogLogger() : new FileLogger();
