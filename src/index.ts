import 'cross-fetch/polyfill';
import type {ILoggerLike} from '@avanio/logger-like';

interface IProps {
	delay?: number;
	logger?: ILoggerLike;
	fetchClient?: typeof fetch;
}

interface IProgressPayload {
	readonly url: string;
	start: Date | undefined;
	received: number | undefined;
	size: number | undefined;
	done: boolean;
}

type ProcessCallback = (progress: IProgressPayload) => void;

/**
 * Process all stream results
 */
async function processAllResult(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	payload: IProgressPayload,
	progressCallback: ProcessCallback,
	logger: ILoggerLike | undefined,
): Promise<void> {
	const firstBlock = await reader.read();
	return new Promise((resolve, reject) => {
		const processResult = async (result: ReadableStreamReadResult<Uint8Array>): Promise<ReadableStreamReadResult<Uint8Array> | void> => {
			try {
				logger?.debug(`[fetch] tracking block progress done: ${result.done}`);
				if (result.done) {
					payload.done = true;
					progressCallback({...payload});
					resolve();
					return;
				}
				payload.received = result.value.length;
				progressCallback({...payload});
				const nextBlock = await reader.read();
				processResult(nextBlock);
			} catch (error) {
				logger?.error(`[fetch] tracking block error: ${error.message}`);
				reject(error);
			}
		};
		processResult(firstBlock);
	});
}

/**
 * Track the progress of a fetch request.
 * @param {Response} res current fetch response
 * @param {ProcessCallback} progressCallback to get progress updates
 * @param {Date} start optional start time
 * @param {ILoggerLike} logger any logger like object
 * @returns {Promise<boolean>} true if did read the stream
 */
export async function trackStreamProcess(
	res: Response,
	progressCallback: ProcessCallback,
	start = new Date(),
	logger?: ILoggerLike | undefined,
): Promise<boolean> {
	const trackingRes = res.clone();
	if (trackingRes.body && trackingRes.body.getReader) {
		logger?.debug('[fetch] tracking stream status');
		const contentLength = res.headers.get('Content-Length');
		const size = contentLength ? parseInt(contentLength) : undefined;
		const payload: IProgressPayload = {done: false, received: 0, size, start, url: res.url};
		progressCallback(payload);
		const reader = trackingRes.body.getReader();
		await processAllResult(reader, payload, progressCallback, logger);
		return true;
	} else {
		return false;
	}
}

/**
 * extract fetch argument types
 */
type FetchArguments = Parameters<typeof fetch>;

export class HttpClient {
	private logger: ILoggerLike | undefined;
	public static getInstance(props?: IProps): HttpClient {
		if (!HttpClient.instance) {
			HttpClient.instance = new HttpClient(props);
		}
		return HttpClient.instance;
	}

	private static instance: HttpClient | undefined;
	private delay = 100; // delay isLoadingCallback
	private isLoadingCallback: undefined | ((isLoading: boolean) => void);
	private isProgressCallback: undefined | ((progress: IProgressPayload) => unknown);

	private loadingResponses = new Set<Promise<Response>>();
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
	}

	public onLoading(callback: (isLoading: boolean) => void): void {
		this.isLoadingCallback = callback;
	}
	/**
	 * Note: this only works if webstreams are supported
	 */

	public onProgress(callback: (progress: IProgressPayload) => unknown): void {
		this.isProgressCallback = callback;
	}

	public count(): number {
		return this.loadingResponses.size;
	}

	public async fetch(input: FetchArguments[0], options?: FetchArguments[1]): Promise<Response> {
		let resPromise: Promise<Response> | undefined;
		try {
			const urlLoading = typeof input === 'string' ? input : (input as Request).url;
			this.logger?.debug('[fetch]', urlLoading);
			// setup promise
			resPromise = fetch(input, options);
			const start = new Date();
			this.loadingResponses.delete(resPromise);
			this.loadingResponses.add(resPromise);
			this.handleLoadingStateUpdate();
			// wait fetch promise
			const res = await resPromise;
			this.logger?.debug('[fetch]', urlLoading + ' status: ' + res.status);
			if (this.isProgressCallback) {
				await trackStreamProcess(res, this.isProgressCallback, start, this.logger);
			}
			return res;
		} catch (err) {
			this.logger?.error('[fetch]', err);
			throw err;
		} finally {
			this.closeReponse(resPromise);
		}
	}

	private closeReponse(resPromise: Promise<Response> | undefined): void {
		if (!this.delay) {
			this.removeResponse(resPromise);
		} else {
			setTimeout(() => this.removeResponse(resPromise), this.delay);
		}
	}

	private removeResponse(resPromise: Promise<Response> | undefined) {
		resPromise && this.loadingResponses.delete(resPromise);
		this.handleLoadingStateUpdate();
	}

	private handleLoadingStateUpdate() {
		if (this.isLoadingCallback) {
			if (this.loadingResponses.size > 0 && this.wasLoading === false) {
				this.wasLoading = true;
				this.isLoadingCallback(this.wasLoading);
			} else if (this.loadingResponses.size === 0 && this.wasLoading === true) {
				this.wasLoading = false;
				this.isLoadingCallback(this.wasLoading);
			}
		}
	}
}
