import 'cross-fetch/polyfill';
import {LoggerLike} from './interfaces/loggerLike';

interface IProps {
	delay?: number;
	logger?: LoggerLike;
}

interface IProgressPayload {
	readonly url: string;
	readonly start: Date | undefined;
	readonly received: number | undefined;
	readonly size: number | undefined;
}

export class HttpClient {
	private logger: LoggerLike | undefined;
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

	private loadingResponses = new Set<Response>();
	private wasLoading = false;
	// we should not call "new" outside
	private constructor(props?: IProps) {
		if (props && props.delay !== undefined) {
			this.delay = props.delay;
		}
		this.logger = props?.logger;
		this.fetch = this.fetch.bind(this);
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

	public async fetch(input: RequestInfo, options?: RequestInit | undefined): Promise<Response> {
		let res: Response | undefined;
		try {
			const urlLoading = typeof input === 'string' ? input : (input as Request).url;
			this.logger?.debug('[fetch]', urlLoading);
			const start = new Date();
			res = await fetch(input, options);
			this.logger?.debug('[fetch]', urlLoading + ' status: ' + res.status);
			this.loadingResponses.delete(res);
			this.loadingResponses.add(res);
			this.handleLoadingStateUpdate();
			const self = this;
			// track progress if it's supported
			const trackingRes = res.clone();
			if (trackingRes.body && trackingRes.body.getReader) {
				const contentLength = res.headers.get('Content-Length');
				const size = contentLength ? parseInt(contentLength) : undefined;
				let received = 0;
				self.isProgressCallback && self.isProgressCallback({url: urlLoading, start, received, size});
				const reader = trackingRes.body.getReader();
				reader.read().then(function processResult(result): any {
					if (result.done) {
						// payload loading is done, let's update status and emit empty progress data
						self.removeResponse(res);
						self.isProgressCallback && self.isProgressCallback({url: urlLoading, start: undefined, received: undefined, size: undefined});
						return;
					}
					// result.value for fetch streams is a Uint8Array
					received += result.value.length;
					self.isProgressCallback && self.isProgressCallback({url: urlLoading, start, received, size});
					// Read some more, and call this function again
					return reader.read().then(processResult);
				});
			} else {
				// we can't know when data payload is actually loaded, just push some general delay here
				setTimeout(() => this.removeResponse(res), this.delay);
			}
			return res;
		} catch (err) {
			this.logger?.error('[fetch]', err);
			setTimeout(() => this.removeResponse(res), this.delay);
			throw err;
		}
	}

	private removeResponse(res: Response | undefined) {
		res && this.loadingResponses.delete(res);
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
