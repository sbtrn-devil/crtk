# crtk-run: command line runner

`crtk` simplifies your code writing life when dealing with asynchronous APIs. However, when you are going to apply it for writing small ad hoc CLI scripts, you may notice an issue. A smallest boilerplate for a `crtk` powered script would look like this:

```js
const {
  start
} = require("crtk");

const yourAsyncMethod = require("blahblahblah").blahblahblah;

start(function *main() {
  var result = (yourAsyncMethod(SYNC), yield *SYNCW());
  console.log(`Result: ${result}`);
}).await(function finalize(err) {
  if(err) { throw err; }
});
```

Not that much, but if your script is really small and typing such scripts is a common task, extra letters may become somewhat annoying and reduce your productivity.

`crtk-run` allows you to reduce the boilerplate to about:

```js
const yourAsyncMethod = require("blahblahblah").blahblahblah;
module.exports = function *main() {
  var result = (yourAsyncMethod(SYNC), yield *SYNCW());
  console.log(`Result: ${result}`);
};
```

and also offers a couple of other conveniences.

## Basic use case

Install `crtk` globally:

```
npm install crtk -g
```

Then, assuming you have a `myscipt.js` file like this:

```js
// note this is not an excerpt, this is really _the whole_ myscript.js
module.exports = function *main(...args) {
  console.log(`Hello world, you gave me the arguments: ${args}`);
  setTimeout(SYNC, 1000), yield *SYNCW();
  console.log("Seeya world");
};
```

Run it from command line with:

```
crtk-run myscript.js
```

Or with some arguments:

```
crtk-run myscript.js foo bar baz
```

That's all.

## Details

`crtk-run` takes at least one parameter which is either a "filename.js" or a "filename.js:exportName". It `require`-s the said file, takes a given member of its module.exports (assuming it is a function or a generator) and `start`-s it in a coroutine, using a wrapper similar to one listed in the beginning.

```js
// runme.js
module.exports.bell = function *bell() {
  // crtk-run runme.js:bell
  console.log("dinn...");
  setTimeout(SYNC, 1000), yield *SYNCW();
  console.log("...nng");
};

// general function is allowed too, similarly to crtk.start
module.exports.whistle = function whistle() {
  // crtk-run runme.js:whistle
  console.log("phew");
};

// and node 7+ async functions are allowed as well
const { NowThen } = require('crtk'); // though using them may be more verbose
module.exports.tiger = async function tiger() {
  // crtk-run runme.js:tiger
  var nt = NowThen();
  await(setTimeout(nt.SYNC, 1000), nt.SYNCW);
  console.log("well, say meow");
};
```

If export name is not provided, then the module.exports object itself is considered.

```js
// hello.js
module.exports = function main() {
  // crtk-run hello.js
  console.log("Hello world");
};
```

For further convenience, the CLI arguments past the script:exportName are passed to the called function/generator as function arguments. The example was shown above under "Basic use case".
