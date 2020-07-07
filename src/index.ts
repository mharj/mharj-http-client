import 'cross-fetch/polyfill';
import {v4 as uuid} from 'uuid';

interface IProps {
	delay?: number;
}

export class HttpClient {
	public static getInstance(props?: IProps): HttpClient {
		if (!HttpClient.instance) {
			HttpClient.instance = new HttpClient(props);
		}
		return HttpClient.instance;
	}

	private static instance: HttpClient | undefined;
	private delay = 100; // delay isLoadingCallback
	private isLoadingCallback: undefined | ((isLoading: boolean) => void);

	private loadingUuidList: string[] = [];
	// we should not call "new" outside
	private constructor(props?: IProps) {
		if (props && props.delay !== undefined) {
			this.delay = props.delay;
		}
		this.fetch = this.fetch.bind(this);
		this.onLoading = this.onLoading.bind(this);
	}

	public onLoading(callback: (isLoading: boolean) => void): void {
		this.isLoadingCallback = callback;
	}

	public async fetch(input: RequestInfo, options?: RequestInit | undefined): Promise<Response> {
		const id = uuid();
		if (this.addUuid(id) && this.isLoadingCallback) {
			this.isLoadingCallback(this.isLoading());
		}
		try {
			const res = await fetch(input, options);
			setTimeout(() => this.handleLoadingState(id), this.delay);
			return Promise.resolve(res);
		} catch (err) {
			setTimeout(() => this.handleLoadingState(id), this.delay);
			throw err;
		}
	}

	private handleLoadingState(id: string) {
		if (this.dropUuid(id) && this.isLoadingCallback) {
			this.isLoadingCallback(this.isLoading());
		}
	}

	private dropUuid(id: string): boolean {
		const wasLoading = this.isLoading();
		const idx = this.loadingUuidList.findIndex((u) => u === id);
		if (idx !== -1) {
			this.loadingUuidList.splice(idx);
		}
		return wasLoading !== this.isLoading();
	}

	private addUuid(id: string): boolean {
		const wasLoading = this.isLoading();
		this.loadingUuidList.push(id);
		return wasLoading !== this.isLoading();
	}

	private isLoading(): boolean {
		return this.loadingUuidList.length !== 0;
	}
}
