# mharj-http-client

```javascript
// initialize http client
const {fetch, onLoading} = HttpClient.getInstance();
onLoading( (state) => {
    // do something for state boolean i.e. update redux state
});
export default fetch;
```