# mharj-http-client

```javascript
// initialize http client with 200ms delay on loading state change if progress is not supported (defaults 100ms)
const {fetch, onLoading} = HttpClient.getInstance({delay: 200});
onLoading( (state) => {
    // do something for state boolean i.e. update redux state
});
onProgress( (progress) => {
    // do something with download progress data {start: Date, received: number, size: number}
})
export default fetch;
```

## with logger (console, log4js)
```javascript
// initialize http client
const {fetch} = HttpClient.getInstance({logger: console});
export default fetch;
```