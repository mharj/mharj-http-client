/* eslint-disable import/first */
process.env.NODE_ENV = 'testing';
import {expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import {HttpClient} from '../src/index';
// tslint:disable: no-unused-expression
chai.use(chaiAsPromised);

const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

describe('http-client', () => {
	it('test loading google.com', async () => {
		const {fetch, onLoading} = HttpClient.getInstance({delay: 0});
		const states: boolean[] = [];
		onLoading((state) => {
			states.push(state);
		});
		await fetch('https://www.google.com');
		await sleep(100); // wait timeouts
		expect(states).to.be.eql([true, false]);
	});
});
