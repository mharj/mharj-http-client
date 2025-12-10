process.env.NODE_ENV = 'testing';

import type {ILoggerLike} from '@avanio/logger-like';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient, type IProgressPayload, watchResponseProgress} from '../src/index';

function sleep(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
const vitestSpy = vi.fn((..._args: unknown[]) => {});

const logger: ILoggerLike = {
	debug: vitestSpy,
	error: vitestSpy,
	info: vitestSpy,
	trace: vitestSpy,
	warn: vitestSpy,
};

describe('http-client', () => {
	beforeEach(() => {
		vitestSpy.mockReset();
		HttpClient.resetInstance();
	});
	it('test loading google.com', async () => {
		const {fetch, addLoadingEventListener, addProgressEventListener, removeLoadingEventListener, removeProgressEventListener} = HttpClient.getInstance({
			delay: 1,
			logger,
		});
		const states: boolean[] = [];
		const progressList: number[] = [];
		const loadingCallback = (isLoading: boolean): void => {
			states.push(isLoading);
		};
		const progressCallback = (progress: IProgressPayload): void => {
			if (progress.received) {
				progressList.push(progress.received);
			}
		};
		addLoadingEventListener(loadingCallback);
		addProgressEventListener(progressCallback);
		await fetch('https://www.google.com');
		await sleep(100); // wait timeouts
		expect(states).to.be.eql([true, false]);
		expect(progressList.length).to.be.greaterThan(0);
		expect(vitestSpy.mock.calls.length).to.be.eq(3);
		expect(vitestSpy.mock.calls[0][0]).to.be.eq('[fetch] https://www.google.com/');
		expect(vitestSpy.mock.calls[1][0]).to.be.eq('[fetch] https://www.google.com/ status: 200');
		removeLoadingEventListener(loadingCallback);
		removeProgressEventListener(progressCallback);
	});
	it('test download bad request', async () => {
		const {fetch} = HttpClient.getInstance({delay: 1, logger});
		try {
			await fetch('qwe://www.www.zzz');
		} catch (_err: unknown) {}
		expect(vitestSpy.mock.calls.length).to.be.eq(2);
		expect(vitestSpy.mock.calls[0][0]).to.be.eq('[fetch] qwe://www.www.zzz');
		expect(vitestSpy.mock.calls[1][0]).to.be.eq('[fetch] Error qwe://www.www.zzz: TypeError: fetch failed');
	});
	it('test async', async () => {
		const {fetch, count} = HttpClient.getInstance({delay: 2000});
		const res1 = fetch('https://google.com');
		const res2 = fetch('https://google.com');
		expect(count()).to.be.eq(2);
		await Promise.all([res1, res2]);
		await sleep(10); // wait callbacks a bit
		expect(count()).to.be.eq(0);
	});
	it('test manual watch Response progress', async () => {
		const res = await fetch('https://google.com');
		const progressList: number[] = [];
		watchResponseProgress(res, (progress) => progress.received && progressList.push(progress.received), logger);
		await res.text();
		expect(progressList.length).to.be.greaterThan(0);
		expect(vitestSpy.mock.calls.length).to.be.eq(1);
		const message = vitestSpy.mock.calls[0][0];
		if (typeof message !== 'string') {
			throw new Error('message is not a string');
		}
		expect(message.includes('[fetch] tracking stream status, size:')).to.be.eq(true);
	});
});
