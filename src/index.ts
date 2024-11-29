/* eslint-disable @typescript-eslint/no-deprecated */
import type {ILoggerLike} from '@avanio/logger-like';

interface IProps {
	delay?: number;
	logger?: ILoggerLike;
	fetchClient?: typeof fetch;
}

export interface IProgressPayload {
	readonly url: string;
	start: Date | undefined;
	received: number | undefined;
	size: number | undefined;
	done: boolean;
}

export type ProcessCallback = (progress: IProgressPayload) => void;

function buildError(err: unknown): Error {
	if (err instanceof Error) {
		return err;
		/* c8 ignore next 3 */
	}
	return new Error(`Unknown error: ${JSON.stringify(err)}`);
}

/**
 * Safe callback execution
 */
function safeCallback(callback: (...args: unknown[]) => void, logger: ILoggerLike | undefined): void {
	try {
		callback();
		/* c8 ignore next 3 */
	} catch (err) {
		logger?.error(`[fetch] callback exception: ${buildError(err).message}`);
	}
}

function processStreamReaderIterator(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncIterableIterator<Uint8Array> {
	return {
		[Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
			return this;
		},
		async next(): Promise<IteratorResult<Uint8Array>> {
			const {value, done} = await reader.read();
			if (done) {
				return {done, value};
			}
			return {done, value};
		},
	};
}

function notifyCallbacks(callbacks: Iterable<ProcessCallback>, progress: IProgressPayload, logger: ILoggerLike | undefined): void {
	Array.from(callbacks).forEach((progressCallback) => safeCallback(() => progressCallback(progress), logger));
}

/**
 * Process all stream results
 */
// reader: ReadableStreamDefaultReader<Uint8Array>,
export async function processAllResult(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	payload: IProgressPayload,
	progressCallbacks: Iterable<ProcessCallback>,
	logger: ILoggerLike | undefined,
): Promise<void> {
	try {
		payload.received = 0;
		notifyCallbacks(progressCallbacks, {...payload}, logger);
		for await (const rawBuffer of processStreamReaderIterator(reader)) {
			payload.received += rawBuffer.length;
			notifyCallbacks(progressCallbacks, {...payload}, logger);
		}
		payload.done = true;
		notifyCallbacks(progressCallbacks, {...payload}, logger);
		/* c8 ignore next 3 */
	} catch (err) {
		logger?.error(`[fetch] Error reading body stream: ${buildError(err)}`);
	}
}

/**
 * Check if object is iterable
 */
function isIterable<T>(obj: unknown): obj is Iterable<T> {
	return typeof obj === 'object' && obj !== null && Symbol.iterator in obj;
}

/**
 * Watch Response loading progress
 * @example
 * const res = await fetch('https://www.google.com');
 * watchResponseProgress(res, (progress) => console.log(progress));
 * const data = await res.json();
 * @param {Response} res current fetch response
 * @param {ProcessCallback} progressCallbacks to notify about progress
 * @param {ILoggerLike} logger any logger like object
 * @returns {Promise<boolean>} true if did read the stream
 */
export function watchResponseProgress(res: Response, progressCallback: ProcessCallback | Iterable<ProcessCallback>, logger?: ILoggerLike): boolean {
	const progressCallbacks = isIterable(progressCallback) ? progressCallback : [progressCallback];
	if (res.body && Array.from(progressCallbacks).length > 0 && 'getReader' in res.body && 'asyncIterator' in Symbol) {
		const trackingRes = res.clone();
		/* c8 ignore next 3 */
		if (!trackingRes.body) {
			return false;
		}
		const contentLength = res.headers.get('Content-Length');
		const size = contentLength ? parseInt(contentLength, 10) : undefined;
		logger?.debug(`[fetch] tracking stream status, size: ${String(size)}`);
		void processAllResult(trackingRes.body.getReader(), {done: false, received: 0, size, start: new Date(), url: res.url}, progressCallbacks, logger);
		return true;
	}
	return false;
}

export class HttpClient {
	private readonly logger: ILoggerLike | undefined;
	public static getInstance(props?: IProps): HttpClient {
		if (!HttpClient.instance) {
			HttpClient.instance = new HttpClient(props);
		}
		return HttpClient.instance;
	}

	public static resetInstance(): void {
		HttpClient.instance = undefined;
	}

	private static instance: HttpClient | undefined;
	private readonly delay: number = 100; // delay isLoadingCallback

	private readonly isLoadingCallbacks = new Set<(isLoading: boolean) => void>();
	private readonly isProgressCallbacks = new Set<ProcessCallback>();

	private readonly loadingResponses = new Set<Promise<Response>>();
	private wasLoading = false;
	// we should not call "new" outside
	private constructor(props?: IProps) {
		if (props && props.delay !== undefined) {
			this.delay = props.delay;
		}
		this.logger = props?.logger;
		this.fetch = this.fetch.bind(this);
		this.count = this.count.bind(this);
		this.onLoading = this.onLoading.bind(this);
		this.onProgress = this.onProgress.bind(this);
		this.addLoadingEventListener = this.addLoadingEventListener.bind(this);
		this.addProgressEventListener = this.addProgressEventListener.bind(this);
		this.removeLoadingEventListener = this.removeLoadingEventListener.bind(this);
		this.removeProgressEventListener = this.removeProgressEventListener.bind(this);
	}

	/**
	 * @deprecated use addLoadingEventListener instead
	 */
	public onLoading(callback: (isLoading: boolean) => void): void {
		/* c8 ignore next 2 */
		this.isLoadingCallbacks.add(callback);
	}

	public addLoadingEventListener(callback: (isLoading: boolean) => void): void {
		this.isLoadingCallbacks.add(callback);
	}

	public removeLoadingEventListener(callback: (isLoading: boolean) => void): void {
		this.isLoadingCallbacks.delete(callback);
	}

	/**
	 * @deprecated use addProgressEventListener instead
	 */
	public onProgress(callback: (progress: IProgressPayload) => void): void {
		/* c8 ignore next 2 */
		this.isProgressCallbacks.add(callback);
	}

	public addProgressEventListener(callback: (progress: IProgressPayload) => void): void {
		this.isProgressCallbacks.add(callback);
	}

	public removeProgressEventListener(callback: (progress: IProgressPayload) => void): void {
		this.isProgressCallbacks.delete(callback);
	}

	public count(): number {
		return this.loadingResponses.size;
	}

	public async fetch(...[input, options]: Parameters<typeof fetch>): Promise<Response> {
		let resPromise: Promise<Response> | undefined;
		const req = new Request(input);
		try {
			this.logger?.debug(`[fetch] ${req.url}`);
			const clearResponseCallback: ProcessCallback = (process) => {
				if (process.done) {
					this.closeResponse(resPromise, true); // notify loading state change
					this.isProgressCallbacks.delete(clearResponseCallback); // remove callback from list
				}
			};
			this.isProgressCallbacks.add(clearResponseCallback);
			// fallback to remove current callback if not finished in 10 seconds
			setTimeout(() => {
				/* c8 ignore next */
				this.isProgressCallbacks.delete(clearResponseCallback);
			}, 10000);
			// setup promise
			resPromise = fetch(req, options);
			this.loadingResponses.delete(resPromise);
			this.loadingResponses.add(resPromise);
			this.handleLoadingStateUpdate();
			// wait fetch promise
			const res = await resPromise;
			this.logger?.debug(`[fetch] ${req.url} status: ${res.status.toString()}`);
			watchResponseProgress(res, this.isProgressCallbacks, this.logger);
			return res;
		} catch (err) {
			this.logger?.error(`[fetch] Error ${req.url}: ${buildError(err)}`);
			throw err;
		} finally {
			this.closeResponse(resPromise);
		}
	}

	private closeResponse(resPromise: Promise<Response> | undefined, now?: true): void {
		if (!this.delay || now) {
			this.removeResponse(resPromise);
		} else {
			setTimeout(() => {
				this.removeResponse(resPromise);
			}, this.delay);
		}
	}

	private removeResponse(resPromise: Promise<Response> | undefined): void {
		if (resPromise) {
			this.loadingResponses.delete(resPromise);
		}
		this.handleLoadingStateUpdate();
	}

	private handleLoadingStateUpdate(): void {
		if (this.isLoadingCallbacks.size > 0) {
			if (this.loadingResponses.size > 0 && !this.wasLoading) {
				this.wasLoading = true;
				this.isLoadingCallbacks.forEach((callback) => safeCallback(() => callback(this.wasLoading), this.logger));
			} else if (this.loadingResponses.size === 0 && this.wasLoading) {
				this.wasLoading = false;
				this.isLoadingCallbacks.forEach((callback) => safeCallback(() => callback(this.wasLoading), this.logger));
			}
		}
	}
}
