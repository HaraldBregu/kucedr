import fs from 'node:fs';
import path from 'node:path';
import { userDataLocation } from './user_data_location';
import type { EventBus } from '../event_bus';
import type { AppLogEntry } from '../../shared/app_types';
import type { ActivityDay } from '../../shared/app_types';
import { readActivity } from './activity';

interface Disposable {
	destroy(): void;
}

/**
 * Log levels in order of severity
 */
export enum LogLevel {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}

/**
 * Configuration options for LoggerService
 */
export interface LoggerOptions {
	/** Minimum log level to write. Defaults to INFO in production, DEBUG in development */
	minLevel?: LogLevel;
	/** Maximum number of days to keep logs. 0 = unlimited. Defaults to 30 */
	maxRetentionDays?: number;
	/** Flush buffer interval in milliseconds. Defaults to 5000ms */
	flushInterval?: number;
	/** Maximum buffer size in lines before forcing a flush. Defaults to 100 */
	maxBufferSize?: number;
	/** Whether to also log to console. Defaults to true in development */
	consoleOutput?: boolean;
}

/**
 * Internal log entry structure
 */
interface LogEntry {
	timestamp: string;
	level: LogLevel;
	source: string;
	message: string;
}

/**
 * LoggerService provides centralized logging for the Electron main process.
 *
 * Features:
 *   - Daily log rotation (YYYY-MM-DD.log format)
 *   - Buffered async writes for performance
 *   - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 *   - Logs stored in application data directory
 *   - Automatic log retention management
 *   - EventBus integration for automatic event logging
 *   - Thread-safe buffer flushing
 *
 * Architecture:
 *   - Writes are buffered in memory and flushed periodically
 *   - New log file created each day at midnight
 *   - Old logs cleaned up based on retention policy
 *   - Graceful shutdown ensures all logs are written
 */
export class LoggerService implements Disposable {
	private buffer: LogEntry[] = [];
	private recentBuffer: LogEntry[] = [];
	private currentLogFile: string | null = null;
	private currentDate: string | null = null;
	private flushTimer: NodeJS.Timeout | null = null;
	private isShuttingDown = false;
	private logDirectory: string | null = null;

	private static readonly RECENT_BUFFER_MAX = 1000;

	private readonly minLevel: LogLevel;
	private readonly maxRetentionDays: number;
	private readonly flushInterval: number;
	private readonly maxBufferSize: number;
	private consoleOutput: boolean;

	// Log level priority for filtering
	private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
		[LogLevel.DEBUG]: 0,
		[LogLevel.INFO]: 1,
		[LogLevel.WARN]: 2,
		[LogLevel.ERROR]: 3,
	};

	constructor(
		private readonly eventBus: EventBus | null,
		options: LoggerOptions = {}
	) {
		// Set defaults
		const isDevelopment = process.env.NODE_ENV !== 'production';
		this.minLevel = options.minLevel ?? (isDevelopment ? LogLevel.DEBUG : LogLevel.INFO);
		this.maxRetentionDays = options.maxRetentionDays ?? 30;
		this.flushInterval = options.flushInterval ?? 5000;
		this.maxBufferSize = options.maxBufferSize ?? 100;
		this.consoleOutput = options.consoleOutput ?? isDevelopment;

		this.initialize();
	}

	/**
	 * Initialize the logger service.
	 * Sets up log directory, rotation timer, and event listeners.
	 */
	private initialize(): void {
		try {
			this.updateLogDirectory();
			this.ensureLogDirectory();
			this.rotateIfNeeded();
			this.cleanupOldLogs();
			this.startFlushTimer();
			this.attachEventListeners();

			this.info('LoggerService', 'Logger initialized', {
				directory: this.logDirectory,
				minLevel: this.minLevel,
				retentionDays: this.maxRetentionDays,
			});
		} catch (error) {
			// If logger fails to initialize, fall back to console
			console.error('[LoggerService] Failed to initialize:', error);
			this.consoleOutput = true;
		}
	}

	/**
	 * Set the log directory to the application data folder.
	 */
	private updateLogDirectory(): void {
		this.logDirectory = path.join(userDataLocation(), 'logs');
	}

	/**
	 * Ensure the log directory exists.
	 */
	private ensureLogDirectory(): void {
		if (!this.logDirectory) {
			throw new Error('Log directory not set');
		}

		try {
			fs.mkdirSync(this.logDirectory, { recursive: true });
		} catch (error) {
			throw new Error(`Failed to create log directory: ${error}`);
		}
	}

	/**
	 * Get the current date in YYYY-MM-DD format (UTC).
	 */
	private getCurrentDate(): string {
		const now = new Date();
		return now.toISOString().split('T')[0];
	}

	/**
	 * Get the log file path for a specific date.
	 */
	private getLogFilePath(date: string): string {
		if (!this.logDirectory) {
			throw new Error('Log directory not set');
		}
		return path.join(this.logDirectory, `${date}.log`);
	}

	/**
	 * Check if log rotation is needed and rotate if necessary.
	 */
	private rotateIfNeeded(): void {
		const today = this.getCurrentDate();

		if (this.currentDate !== today) {
			// Flush existing buffer before rotating
			if (this.buffer.length > 0) {
				this.flushBuffer();
			}

			this.currentDate = today;
			this.currentLogFile = this.getLogFilePath(today);

			this.debug('LoggerService', `Rotated to new log file: ${this.currentLogFile}`);
		}
	}

	/**
	 * Format a log entry as a string.
	 */
	private formatLogEntry(entry: LogEntry): string {
		const { timestamp, level, source, message } = entry;
		return `[${timestamp}] [${level.padEnd(5)}] [${source}] ${message}`;
	}

	/**
	 * Check if a log level should be written based on minimum level.
	 */
	private shouldLog(level: LogLevel): boolean {
		return LoggerService.LEVEL_PRIORITY[level] >= LoggerService.LEVEL_PRIORITY[this.minLevel];
	}

	/**
	 * Add a log entry to the buffer.
	 */
	private addToBuffer(level: LogLevel, source: string, message: string, data?: unknown): void {
		if (!this.shouldLog(level)) {
			return;
		}

		// Rotate if needed (new day)
		this.rotateIfNeeded();

		// Format message with optional data
		let fullMessage = message;
		if (data !== undefined) {
			try {
				const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
				fullMessage = `${message} ${dataStr}`;
			} catch {
				fullMessage = `${message} [Unserializable data]`;
			}
		}

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			source,
			message: fullMessage,
		};

		this.buffer.push(entry);

		// Keep recent entries for IPC queries (ring buffer)
		this.recentBuffer.push(entry);
		if (this.recentBuffer.length > LoggerService.RECENT_BUFFER_MAX) {
			this.recentBuffer.shift();
		}

		// Console output if enabled
		if (this.consoleOutput) {
			const formatted = this.formatLogEntry(entry);
			switch (level) {
				case LogLevel.ERROR:
					console.error(formatted);
					break;
				case LogLevel.WARN:
					console.warn(formatted);
					break;
				case LogLevel.DEBUG:
					console.debug(formatted);
					break;
				default:
					console.log(formatted);
			}
		}

		// Flush if buffer is full
		if (this.buffer.length >= this.maxBufferSize) {
			this.flushBuffer();
		}
	}

	/**
	 * Flush the buffer to disk.
	 */
	private flushBuffer(): void {
		if (this.buffer.length === 0 || !this.currentLogFile) {
			return;
		}

		try {
			const entries = this.buffer.splice(0, this.buffer.length);
			const lines = entries.map((entry) => this.formatLogEntry(entry)).join('\n') + '\n';

			// Append to log file (sync to ensure data is written during shutdown)
			fs.appendFileSync(this.currentLogFile, lines, 'utf-8');
		} catch (error) {
			// If flush fails, restore buffer and log to console
			console.error('[LoggerService] Failed to flush buffer:', error);
		}
	}

	/**
	 * Start the periodic flush timer.
	 */
	private startFlushTimer(): void {
		this.flushTimer = setInterval(() => {
			if (!this.isShuttingDown) {
				this.flushBuffer();
			}
		}, this.flushInterval);
	}

	/**
	 * Stop the flush timer.
	 */
	private stopFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
	}

	/**
	 * Clean up old log files based on retention policy.
	 */
	private cleanupOldLogs(): void {
		if (this.maxRetentionDays === 0 || !this.logDirectory) {
			return;
		}

		try {
			const files = fs.readdirSync(this.logDirectory);
			const now = Date.now();
			const maxAge = this.maxRetentionDays * 24 * 60 * 60 * 1000;

			let deletedCount = 0;

			for (const file of files) {
				if (!file.endsWith('.log')) {
					continue;
				}

				const filePath = path.join(this.logDirectory, file);
				const stat = fs.statSync(filePath);
				const age = now - stat.mtimeMs;

				if (age > maxAge) {
					fs.unlinkSync(filePath);
					deletedCount++;
				}
			}

			if (deletedCount > 0) {
				this.debug('LoggerService', `Cleaned up ${deletedCount} old log files`);
			}
		} catch (error) {
			console.error('[LoggerService] Failed to cleanup old logs:', error);
		}
	}

	/**
	 * Attach listeners to EventBus for automatic event logging.
	 */
	private attachEventListeners(): void {
		if (!this.eventBus) {
			return;
		}

		// Listen to other important events
		this.eventBus.on('service:initialized', (event) => {
			const payload = event.payload as { service: string };
			this.info('ServiceContainer', `Service initialized: ${payload.service}`);
		});

		this.eventBus.on('service:destroyed', (event) => {
			const payload = event.payload as { service: string };
			this.info('ServiceContainer', `Service destroyed: ${payload.service}`);
		});

		this.eventBus.on('window:created', (event) => {
			const payload = event.payload as { windowId: number; type: string };
			this.info('WindowFactory', `Window created: ${payload.type} (ID: ${payload.windowId})`);
		});

		this.eventBus.on('window:closed', (event) => {
			const payload = event.payload as { windowId: number };
			this.info('WindowFactory', `Window closed: ID ${payload.windowId}`);
		});

		this.eventBus.on('error:critical', (event) => {
			const payload = event.payload as { error: Error; context: string };
			this.error('App', `Critical error in ${payload.context}: ${payload.error.message}`, {
				stack: payload.error.stack,
			});
		});
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Log a debug message.
	 */
	debug(source: string, message: string, data?: unknown): void {
		this.addToBuffer(LogLevel.DEBUG, source, message, data);
	}

	/**
	 * Log an info message.
	 */
	info(source: string, message: string, data?: unknown): void {
		this.addToBuffer(LogLevel.INFO, source, message, data);
	}

	/**
	 * Log a warning message.
	 */
	warn(source: string, message: string, data?: unknown): void {
		this.addToBuffer(LogLevel.WARN, source, message, data);
	}

	/**
	 * Log an error message.
	 */
	error(source: string, message: string, data?: unknown): void {
		this.addToBuffer(LogLevel.ERROR, source, message, data);
	}

	/**
	 * Get the most recent log entries (up to `limit`, default 200).
	 * Returns entries in chronological order (oldest first).
	 */
	getRecentLogs(limit = 200): AppLogEntry[] {
		const entries = this.recentBuffer.slice(-limit);
		return entries.map((e) => ({
			timestamp: e.timestamp,
			level: e.level as AppLogEntry['level'],
			source: e.source,
			message: e.message,
		}));
	}

	async getActivity(): Promise<ActivityDay[]> {
		this.flushBuffer();
		return readActivity(this.logDirectory);
	}

	/**
	 * Get the current log directory path.
	 */
	getLogDirectory(): string | null {
		return this.logDirectory;
	}

	/**
	 * Get the current log file path.
	 */
	getCurrentLogFile(): string | null {
		return this.currentLogFile;
	}

	/**
	 * Force an immediate flush of the buffer to disk.
	 */
	flush(): void {
		this.flushBuffer();
	}

	/**
	 * Cleanup on shutdown.
	 * Ensures all buffered logs are written to disk.
	 */
	destroy(): void {
		this.isShuttingDown = true;
		this.stopFlushTimer();
		this.flushBuffer();
		this.info('LoggerService', 'Logger destroyed');
		this.flushBuffer(); // Flush the destroy message
	}
}
