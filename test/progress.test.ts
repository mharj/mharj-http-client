import {describe, expect, it, vi} from 'vitest';
import {type IProgressPayload, type ProcessCallback, processAllResult} from '../src';

const progressCallback = vi.fn();

// build readable stream of Uint8Array
function buildStream(buffer: Buffer): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>(
		{
			start(controller): void {
				controller.enqueue(new Uint8Array(buffer));
				controller.close();
			},
		},
		{highWaterMark: 1024},
	);
}
// generate random buffer with size argument
function createBuffer(size: number): Buffer {
	const buffer = Buffer.alloc(size);
	for (let i = 0; i < size; i++) {
		buffer[i] = Math.floor(Math.random() * 256);
	}
	return buffer;
}

const bufferSize = 8192;

describe('Progress test', function () {
	it('should', async function () {
		const rawArray: ReadableStreamDefaultReader<Uint8Array> = new ReadableStreamDefaultReader(buildStream(createBuffer(bufferSize)));
		const payload: IProgressPayload = {
			done: false,
			received: undefined,
			size: bufferSize,
			start: new Date(),
			url: 'http://example.com',
		};
		const callbacks = new Set<ProcessCallback>([progressCallback]);
		await processAllResult(rawArray, payload, callbacks, undefined);
		expect(progressCallback).toHaveBeenCalledTimes(3);
	});
});
