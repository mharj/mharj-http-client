# mharj-http-client

```javascript
// initialize http client with 200ms delay on loading state change if progress is not supported (defaults 100ms)
const {fetch, onLoading} = HttpClient.getInstance({delay: 200});
onLoading((state) => {
	// do something for state boolean i.e. update redux state
});
onProgress((progress) => {
	// do something with download progress data {start: Date, received: number, size: number}
});
export default fetch;
```

## with logger (console, log4js)

```javascript
// initialize http client
const {fetch} = HttpClient.getInstance({logger: console});
export default fetch;
```

## track stream process if supported as async (can be run with just callback without await, but it's good then to .catch())

```typescript
const res = await fetch('https://google.com');
/* const wasTracked = */ await trackStreamProcess(res, (data) => console.log(data));
const data = await res.text();
```
