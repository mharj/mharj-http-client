/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable sort-imports */
/* eslint-disable import/first */
process.env.NODE_ENV = 'testing';
import {beforeEach, describe, expect, it} from 'vitest';
import * as sinon from 'sinon';
import {HttpClient, watchResponseProgress, type IProgressPayload} from '../src/index';
import type {ILoggerLike} from '@avanio/logger-like';

function sleep(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
const sinonSpy = sinon.spy((..._args: unknown[]) => {});

const logger: ILoggerLike = {
	debug: sinonSpy,
	error: sinonSpy,
	info: sinonSpy,
	trace: sinonSpy,
	warn: sinonSpy,
};

describe('http-client', () => {
	beforeEach(() => {
		sinonSpy.resetHistory();
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
		expect(sinonSpy.callCount).to.be.eq(3);
		expect(sinonSpy.args[0][0]).to.be.eq('[fetch] https://www.google.com/');
		expect(sinonSpy.args[1][0]).to.be.eq('[fetch] https://www.google.com/ status: 200');
		removeLoadingEventListener(loadingCallback);
		removeProgressEventListener(progressCallback);
	});
	it('test download bad request', async () => {
		const {fetch} = HttpClient.getInstance({delay: 1, logger});
		try {
			await fetch('qwe://www.www.zzz');
		} catch (_err: unknown) {}
		expect(sinonSpy.callCount).to.be.eq(2);
		expect(sinonSpy.args[0][0]).to.be.eq('[fetch] qwe://www.www.zzz');
		expect(sinonSpy.args[1][0]).to.be.eq('[fetch] Error qwe://www.www.zzz: TypeError: fetch failed');
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
		expect(sinonSpy.callCount).to.be.eq(1);
		const message = sinonSpy.firstCall.args[0];
		if (typeof message !== 'string') {
			throw new Error('message is not a string');
		}
		expect(message.includes('[fetch] tracking stream status, size:')).to.be.eq(true);
	});
});
