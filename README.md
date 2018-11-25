[![coverage-98%](https://img.shields.io/badge/coverage-98%25-brightgreen.svg?style=flat)](https://codecov.io/gh/sbtrn-devil/crtk)

# crtk

`crtk` is yet another JavaScript CoRoutine ToolKit based on ES6 generators, which allows you to write asynchronous code in human readable and writeable way, and provides tools for coroutines synchronization and cooperation.

Because `crtk` relies on ES6 features (namely: generators, spreading, `Map`, `Set`, `Symbol`), and its design encourages client code to use ES6 compliant generators, it requires ES6 capable engine (node 6 with --harmony, node >=7, or, if you browserify, a modern version of browser like Firefox/Chrome/Chromium based).

Starting from 1.3, `crtk` takes native ES `Promise` into its orbit, so that users of node 7+ can benefit from both ES2017+ `async` / `await` and `crtk` facilities.

## Why another one?

Callback oriented programming of asynchronous flow is bad. Programming it with coroutines is [good][link-coroutines]. The problem is that up until recently JS provided no accessible ways to write coroutine style code. Introduction of [generators][link-generators] is a large step forward, unfortunately the feature was designed with different goals in mind and is not conditioned for the task out of the box.

A number of libraries around try to provide a coroutine framework around generators. Most notable one is [`co`][link-co]. Unfortunately it is impractical as it is centered around `Promise`-s (which have quite an ugly and unhandy design). Most of `co` counterparts suffer the same drawback. Better approach is offered in [`asyncblock`][link-asyncblock], but it feels somewhat awkward and unnecessarily overcomplicated.

### We already have node 7+ and async/await, we don't care!

Ok, write an async function that waits for 250 ms using setTimeout.

```js
async function justWait() {
  setTimeout // ...
  // but... node 7+... async...
}
```

With advent of ES2017, latest major versions of node support `async` / `await`, which sweeps most of `Promise` atrocities under the carpet and allows easy coroutine coding based on native ES `Promise`-s. Unfortunately its interface to callback driven world is still far from having a human face, so the problem is still on the table.

`crtk` tries to address the issues:

- Minimize wrapping code. Express the asynchronous flow not just in "synchronous" styled code, but in the code that looks as natural as possible, does exactly what it reads, and does not require a reading eye to stumble on sophisticated constructs.
- Minimize intrusiveness. You do not need to "promisify" existing 3rd party interfaces or make fat wrappers just to adopt them to coding model `crtk` offers: in most cases a problem is solved inline.
- Cooperative multitasking. `crtk` keeps in mind that multiple coroutines may need to cooperate and synchronize, as well with each other as with "plain old async code", and provides appropriate tools.
- Bringing it all together. Starting from 1.3, `crtk` attempts to provide as seamless interface between callback-driven APIs, `async`/`await` (if using node 7+), and its own generator based coroutines as possible. Promisification must die!

## Installation

```
npm install crtk
```

or globally:

```
npm install crtk -g
```


## Usage overview

Assume we have an async operation that reports its result in plain old node way, via callback to `function(err, result)`, where non-false `err` means an error, otherwise `result` contains the result:

```js
function calculateValuableFunction(x, callback) {
  setTimeout(function () {
    if (Math.random() < 0.99) {
      callback(null, x + 42);
    } else {
      callback(new Error("Insufficient resources"));
    }
  }, 250);
}
```

Let's see how `crtk` helps us to handle it.

### Basics

In `crtk` you express this way:

```js
const {
  start
} = require("crtk");

/*
A coroutine can be based on any generator.
You of course need to keep in mind that its code is a coroutine, not
a literal generator, so we will refer to such functions as "coroutine
generators".
*/
function *myCoroutine() {
  try {
    var y = (calculateValuableFunction(100, SYNC), yield *SYNCW());
    console.log(`Valuable function delivered result of ${y}`);
  } catch (e) {
    console.log(`Valuable function failed: ${e}`);
  }
}

// if we want coroutine to do something, we need to launch it
start(myCoroutine());
// start(myCoroutine); is allowed too
```

Couple of details to explain here:
- SYNC and SYNCW are "magic" pseudo-global variables that are only defined inside generator when it runs as coroutine (that is, started by `start` function),
- SYNC resolves to a one-shot callback of `(err, result)` signature, which is called a continuation of current coroutine,
- SYNCW resolves to helper sub-generator intended for use in `yield *SYNCW()` form. This expression causes the current coroutine to yield, then resume when callback (previously obtained in it via `SYNC`) is called by whoever. The `yield *SYNCW()` expression returns result delivered by the continuation callback, or, if it delivered an error, throws the error (so errors translate to exceptions naturally). The `(calculateValuableFunction(..., SYNC), yield *SYNCW())` pattern is therefore a counterpart of `calculateValuableFunction(...)` if the calculateValuableFunction were synchronous.

A nice thing here is that not only the code is "semantically synchronous", but it also does what it looks like. You clearly see you are calling `calculableValuableFunction`, then yielding, then use a value returned by helper generator, and this is quite what actually happens.

### Coroutine parameters

Coroutine generator is free to take any parameters.

```js
function *coroutineWithParameter(x) {
  var y = (calculateValuableFunction(x, SYNC), yield *SYNCW());
  console.log(`Valuable function delivered result of ${y}`);
  // ditch the failure handling this time for brevity
}

start(coroutineWithParameter(100));
```

### Method coroutines

Coroutine generator can be a method.

```js
var anObject = {
  x: 100500,
  method: function *method(z) {
    var y = (calculateValuableFunction(this.x + z, SYNC), yield *SYNCW());
    console.log(`Valuable function delivered result of ${y}`);
  }
};

start(anObject.method(100));
```

### Nested calls

A coroutine can call coroutine generators via `yield *expr(...)` expression in manner and meaning of a nested function call. `yield *SYNCW()` is the most obvious example.

```js
function *calculate(x) {
  // yes, we can return values in natural way
  return (calculateValuableFunction(x, SYNC), yield *SYNCW());
}

function *coroutineWithParameter(x) {
  var y = yield *calculate(x);
  console.log(`Calculation delivered result of ${y}`);
}
```

### Multiple coroutines

Multiple coroutines can be started and work in parallel.

```js
for (var i = 0; i < 10; i++) {
  start(coroutineWithParameter(i));
}
```

Of course a coroutine itself can also start other coroutines:

```js
function *inferiorCoroutine(x) {
  var y = (calculateValuableFunction(x, SYNC), yield *SYNCW());
  console.log(`Valuable function delivered result of ${y} to inferior`);
}

function *superiorCoroutine(x) {
  for (var i = 0; i < 10; i++) {
    start(inferiorCoroutine(i));
  }

  // our own piece of work while they are slaving away
  var y = (calculateValuableFunction(100, SYNC), yield *SYNCW());
  console.log(`Valuable function delivered result of ${y} to superior`);
}
```

### Awaiters

If a piece API does not fall into `function(err, result)` convention, you can adapt it using `Awaiter` helper:

```js
const unirest = require("unirest"); // https://www.npmjs.com/package/unirest

const {
  Awaiter
} = require("crtk");

function *unirestRequest() {
  var delivered = Awaiter(); // _not_ new Awaiter!

  unirest.post('http://mockbin.com/request')
  .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
  .send({ "parameter": 23, "foo": "bar" })
  .end(function(response) {
    if(response.statusType != 2) {
        // delivered is also a one-shot (err, result) function
        delivered(new Error(`HTTP error: status ${response.status}`));
      } else {
        delivered(null, response.body);
      }
  });

  // that does the trick
  return (delivered.await(SYNC), yield *SYNCW());
}

// also try to imagine how the same would look on Promise based frameworks
```

### Awaiting and returning result from coroutine

A coroutine can return result or throw an error:

```js
// coroutine style version of calculateValuableFunction
function *calculateValuableFunctionAsCRTN(x) {
  setTimeout(SYNC, 250), yield *SYNCW();
  if (Math.random() < 0.99) {
    return x + 42;
  } else {
    throw new Error("Insufficient resources");
  }
}
```

In order to make use of it, we notice the object returned by `start` function: it is the _coroutine handle_ with some useful stuff, of which we need `await` method:

```js
var crtn = start(calculateValuableFunctionAsCRTN(100));
// the code below looks familiar, doesn't it?
crtn.await(function(err, result) {
  if (err) {
    console.log(`calculateValuableFunctionAsCRTN thrown an error: ${err}`);
  } else {
    console.log(`calculateValuableFunctionAsCRTN delivered result of ${result}`);
    console.log(`it is also available like this: ${crtn.result}`);
  }
});
```

Pieces get in place when it gets about cooperative coroutines:

```js
function *superiorCoroutine() {
  var requestCrtns = new Array();
  for (var i = 0; i < 10; i++) {
    requestCrtns.push(start(unirestRequest));
  }

  // while they are all spinning we can do something useful...
  console.log(`Valuable result: ${yield *calculateValuableFunctionAsCRTN(100)}`);

  // collect the results
  for (var i = 0; i < 10; i++) {
    console.log(`Request ${i} result: ${requestCrtns[i].await(SYNC), yield *SYNCW()}`);
  }

  // ...continue work
}
```

### Checkpoints

The last example from previous chapter shows us a not so rare task of launching several collaborators in parallel, waiting until they complete, and assembling the result. Method shown above is viable, but not very convenient and has an unobvious issue: if a thrown coroutine is encountered in "collect the results" loop, all the coroutines after it will fall out of check (which may not always be admissible). `crtk` offers more solid tool for such needs, a checkpoint:

```js
const {
  Checkpoint
} = require("crtk");

function *superiorCoroutine() {
  var request1 = start(unirestRequest),
    request2 = start(unirestRequest),
    request3 = start(unirestRequest);

  try {
    Checkpoint.allOf(request1, request2, request3) // make a checkpoint instance
    .await(SYNC), yield *SYNCW();
  } catch (checkpointResult) {
    // on failure of either subject, a special object CheckpointResult
    // will be delivered as error of awaiting the checkpoint
    console.log(`${checkpointResult.errors.length} requests ended in failure, won't do`);
    throw new Error("FAILURE");
  }

  console.log(`Results: ${[request1.result, request2.result, request3.result]}`);
}
```

### So, what's about node 7+ and async/await?

Remember the example from introduction? `crtk` (1.3+) can help you with that:

```js
const {
  start,
  NowThen
} = require("crtk");

async function justWait() {
  var nt = NowThen();
  await(setTimeout(nt.SYNC, 250), nt.SYNCW);
  // which is in line with the main crtk pattern you could see above
}

// and use!
var justWaitAsPromise = justWait();
justWaitAsPromise.then(...);
var justWaitAsCoroutine = start(justWait); // you can do this way too
justWaitAsCoroutine.await(...);
```

In addition, coroutine handles, `Awaiter`-s and `Checkpoint`-s are also `Promise`-like objects, so you can `await` them too.

```js
async function meIsAsync() {
  var crtn = start(function *meIsAsyncToo() {
    setTimeout(SYNC, 250), yield *SYNCW();
    return 101;
  });

  var result = await crtn; // yes, result == 101
}
```

Finally, `crtk` upgrades ES native `Promise` prototype, so that `async` function is now a valid `crtk` awaitable object.

```js
function *anotherCoroutine() {
  async function anotherAsyncFunction() {
    return 42;
  }

  var result = (anotherAsyncFunction().await(SYNC), yield *SYNCW()); // 42

  // or in a checkpoint
  Checkpoint.allOf(
    anotherAsyncFunction(),
    start(function *anotherInnerCoroutine() {
      return 43;
    })
  ).await(SYNC), yield *SYNCW(); // wait them both to complete
}
```

So the `crtk` <-> `async` / `await` / `Promise` interop is full two-way, you can mix them for any convenience and leverage the good parts of both.

## Command line runner

Since 1.1.0 `crtk` comes with helper `crtk-run` that allows to run functions/generators (since 1.3, async functions too) exported from .js files as `crtk`-flavored coroutines directly from command line, which allows to save time when writing quick scripts that use asynchronous APIs. More info [here][link-docs-crtk-run].

## Further reading

These were the basic use cases showing `crtk` principles and core features. But there is more to it, including coroutine cancellation, feedback events, and coroutine local variables. Check [API description][link-docs-api] for more detailed and systematic insight.

[link-coroutines]: https://medium.com/@tjholowaychuk/callbacks-vs-coroutines-174f1fe66127#.t6myc7mwz
[link-generators]: https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Statements/function*
[link-co]: https://npmjs.org/package/co
[link-asyncblock]: https://www.npmjs.com/package/asyncblock
[link-docs-api]: docs/api.md
[link-docs-crtk-run]: docs/crtk-run.md
