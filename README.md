# mharj-http-client

```typescript
// initialize http client with 200ms delay on loading state change if progress is not supported (defaults 100ms)
const {fetch, addLoadingEventListener, addProgressEventListener} = HttpClient.getInstance({delay: 200});
addLoadingEventListener((isLoading: boolean) => {
	// do something for state boolean i.e. update redux state
});
addProgressEventListener((progress: IProgressPayload) => {
	// do something with download progress data {url: string; start?: Date; received?: number; size?: number; done: boolean}
});
export default fetch;
```

## with logger (console, log4js)

```typescript
// initialize http client
const {fetch} = HttpClient.getInstance({logger: console});
export default fetch;
```

## track Response body readable stream (if body stream reading is supported)

```typescript
const res = await fetch('https://google.com');
watchResponseProgress(res, (progress) => console.log(progress));
const data = await res.text();
```
