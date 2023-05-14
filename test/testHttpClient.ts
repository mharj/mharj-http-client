/* eslint-disable import/first */
process.env.NODE_ENV = 'testing';
import {expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import * as sinon from 'sinon';
import {HttpClient} from '../src/index';
import type {ILoggerLike} from '@avanio/logger-like';

// tslint:disable: no-unused-expression
chai.use(chaiAsPromised);

const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
const fake = sinon.fake();

describe('http-client', () => {
	it('test loading google.com', async () => {
		const logger: ILoggerLike = {
			debug: fake,
			trace: fake,
			info: fake,
			warn: fake,
			error: fake,
		};
		const {fetch, onLoading} = HttpClient.getInstance({delay: 0, logger: logger});
		const states: boolean[] = [];
		onLoading((state) => {
			states.push(state);
		});
		await fetch('https://www.google.com');
		await sleep(100); // wait timeouts
		expect(states).to.be.eql([true, false]);
		expect(fake.callCount).to.be.eq(2);
		expect(fake.args[0][0]).to.be.eq('[fetch]');
		expect(fake.args[0][1]).to.be.eq('https://www.google.com');
		expect(fake.args[1][0]).to.be.eq('[fetch]');
		expect(fake.args[1][1]).to.be.eq('https://www.google.com status: 200');
		fake.resetHistory();
	});
	it('test download bad request', async () => {
		const logger: ILoggerLike = {
			debug: fake,
			trace: fake,
			info: fake,
			warn: fake,
			error: fake,
		};
		const {fetch} = HttpClient.getInstance({delay: 0, logger: logger});
		try {
			await fetch('qwe://www.www.zzz');
		} catch (err) {}
		expect(fake.callCount).to.be.eq(2);
		expect(fake.args[0][0]).to.be.eq('[fetch]');
		expect(fake.args[0][1]).to.be.eq('qwe://www.www.zzz');
		expect(fake.args[1][0]).to.be.eq('[fetch]');
		expect(fake.args[1][1]).to.be.instanceOf(TypeError);
		fake.resetHistory();
	});
	it('test async', async () => {
		const {fetch, count} = HttpClient.getInstance({delay: 0});
		const res1 = fetch('https://google.com');
		const res2 = fetch('https://google.com');
		expect(count()).to.be.eq(2);
		await Promise.all([res1, res2]);
		expect(count()).to.be.eq(0);
	});
});
