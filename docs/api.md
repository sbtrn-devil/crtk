## Foreword about notation

- Identifier in single quotes (`'LikeThis'`) means that no class, symbol, field, variable/constant, prototype, nor other solid JS meta-entity correspond to this value, this is an "anonymous" object just given a convenience name for description purposes.
- Identifier with no quotes (`LikeThis`) refers to a value, a variable or a property that is stored under a name and can be accessed in some way, or to a JS keyword.

## 'Awaitable': _interface_

`'Awaitable'` interface represents an operation with a deferred result and provides interface for interested consumer(s) to access the result when ready. Conceptual difference from a Promise is that `'Awaitable'` represents an already running operation, there can be multiple consumers to its result, and they can be subscribed at any moment - including after the operation has completed.

An object compliant with `'Awaitable'` interface must provide the following fields and meet the following requirements:

### .await(callback): _method_

- `callback`: _function(err, result)_ - result notification callback

Subscribe a consumer to await the operation result. Result will be delivered by calling the `callback`. If operation delivers an error, the `err` parameter will contain a non-false value (an instance of `Error` for example), otherwise `result` parameter will contain the operation result value.

There can be multiple subscribers awaiting, and it is legal to call `.await` at any time. `'Awaitable'` compliance requires that invocation of any `.await`-ing callback is guaranteed (any exactly once) after the result is available, regardless on whether they were subscriber before or after actual completion. In the latter case a callback will be called on next soonest asynchronous occasion.

If there are multiple callbacks, order of callbacks invocation is unspecified and is up to the implementor.

Subscribing same instance of `callback` to the same `'Awaitable'` is not encouraged and should be considered an undefined behaviour.

### [optional] .unawait(callback): _method_

- `callback`: _function(err, result)_ - result notification callback

`'Awaitable'` may, and is highly recommended to, implement `.unawait` method that removes the given `callback` from the result notification list. If should prevent the callback from being called if invoked before the `'Awaitable'` is done.

If `callback` is not on the list, the method must do nothing.

All `crtk` built-in `'Awaitable'` implementations implement the `.unawait`.

### .done: _Boolean_

Read-only property that is `false` when an operation is still running or `true` when it has completed and the result available.

Sets to `true` just before a notification callback is called, therefore is always seen as `true` from callbacks code.

## 'Promise-ish': _interface_ (since 1.3)

This interface is compatible with that of ES native `Promise` to a degree enough that the implementing object can be used with ES2017 `await` statement.

`'Promise-ish'` object also works in other basic `Promise` use cases (`Promise.all`, `Promise.resolve` etc.), but its primary purpose in `crtk` is to bridge the implementing objects to `await` statement, so other uses are not a goal.

### .then(resultCallback, errorCallback): _method_

- resultCallback: _function(result)_
- errorCallback: _function(err)_

Implements `Promise.then` method. Refer to ES `Promise` spec for more details on the logic behind it.

### .catch(errorCallback): _method_

- errorCallback: _function(err)_

Implements `Promise.catch` method. Refer to ES `Promise` spec for more details on the logic behind it.

## 'Cancellable': _interface_

- extends: `'Awaitable'`

`'Cancellable'` represents an `'Awaitable'` operation that can be canceled. Meaning, agenda and consequences of cancellation are up to particular implementor.

An object compliant with `'Cancellable'` interface must provide the following fields and meet the following requirements:

### .cancel([cancelMsg]): _method_

- `cancelMsg`: _any_ - optional extra cancellation message

Initiate the cancel. Actual cancellation operations do not need to be performed synchronously, `.cancel` may only initiate them. However, the following requirements must be met.

First, `Cancellable` assumes that an operation can only be canceled once, and cancellation is irrevertible, but `.cancel` must be always safe to call. Therefore, to comply with `Cancellable`, the implementor must ensure that 2nd and subscequent calls to `.cancel` are no-ops.

Second, whatever the cancel means, the requirement is to not prevent the `'Awaitable'` from normal way of indicating completion (with `.done = true` and invocation of callbacks). Implementor may deliver cancel case as a special error.

Cancel request may come with an attached cancellation message, specified by the canceler in `cancelMsg` argument. Use and meaning of this parameter are up to the implementor.

## start(mainFunction, ...args): _function: 'CoroutineHandle'_

*NOTE*: since 1.4 there exists more convenient form of this function for generator based and `async` function based coroutines - see `start(mainIteratorOrPromise)`.

- `mainFunction`: _generator_, _function_ or _async function_ - the coroutine main function
- `args`: list of _any_ - arguments to pass to the coroutine main function
- return: handle of the started coroutine

The function starts a coroutine that executes given function.

In most cases you want to pass a generator for `mainFunction`, as you can use `yield` operator in meaning of "wait for asynchronous result" (see `SYNC`/`SYNCTL` and `SYNCW`). However, usual function and (in node 7+) `async` function is allowed too. The logic of coroutine framework will be the same in either case, though using non-generator will have some disatvantages:

- the code of a plain function will be not able to leverage yielding or any other coroutine features (pseugo-globals, feedback events emission, cancellation - read further for more on all of these),
- the code of `async` function will be not able to leverage any coroutine features, and will need `NowThen` helper to use `SYNC`+`SYNCW` pattern with `await`.

Therefore `crtk` encourages use of generator-based coroutines, as they have the strongest support.

```js
const { start } = require("crtk");

function *thisIsAGenarator() {
  console.log("Step 1: sleep for 250 seconds...");
  setTimeout(SYNC, 250); yield *SYNCW();
  console.log("Step 2: ok");
}

start(thisIsAGenerator);

function *thisIsAGeneratorWithParameters(x, y) {
  console.log(`x = ${x}`);
  setTimeout(SYNC, 250); yield *SYNCW();
  console.log(`y = ${y}`);
}

function thisIsAPlainFunction() {
  console.log("Mundane function can not into yield");
  console.log ("It has no option than to finish in one go");
}

start(thisIsAPlainFunction);

// node 7+ only
const { NowThen } = require("crtk");
async function thisIsAnAsyncFunction() {
  var nt = NowThen();
  console.log("Step 1: sleep for 250 seconds...");
  setTimeout(nt.SYNC, 250); await nt.SYNCW;
  // or: await(setTimeout(nt.SYNC, 250), nt.SYNCW);
  console.log("Step 2: ok");
}

start(thisIsAnAsyncFunction);
```

Multiple coroutines can be started and work in parallel (in meaning of single-threaded asynchronous parallelism established in JS).

```js
function *sleep(ms) {
  console.log(`sleep for ${ms} ms...`);
  setTimeout(SYNC, ms); yield *SYNCW();
}

start(sleep, 100);
start(sleep, 500);
start(sleep, 1000);
// sleep for 100 ms...
// sleep for 500 ms...
// sleep for 1000 ms...
// (1000 ms delay)
```

`this` context in which the coroutine function is invoked should be assumed undefined. \[Currently it is global object, but this assumption must not be relied on.\] If you need to start a coroutine as a method of some object, you use `beginMethod` helper (see below).

`start` returns a coroutine handle, object that allows to control and synchronize on the coroutine. See `'CoroutineHandle'` for more info. Coroutine code will start actual execution on next soonest asynchronous occasion.

Note that, from coroutine perspective, any pending asynchronous code (including code from other coroutines) is only "allowed" to run during `yield *SYNCW()` statements (`await nowThen.SYNCW` for `async` function based coroutines).

## startMethod: _Symbol_

In order to allow starting coroutines from objects methods, `Object` prototype is extended with a special helper method, accessible via `Symbol` `startMethod`:

```js
const startMethod = require("crtk").startMethod;
```

### Object[startMethod] (methodId, ...args): _method: 'CoroutineHandle'_

*NOTE*: since 1.4 there exists more convenient form of this function for generator-method based and `async` function-method based coroutines - see `start(mainIteratorOrPromise)`.

- `methodId`: _string_ or _Symbol_ - id of the method
- `args`: list of _any_ - parameters to pass to the method
- return: handle of the started coroutine

You use `beginMethod` on an object to start a method as a coroutine this way:

```js
var anObject = {
  x: 667,
  someMethod: function *someMethod(p1, p2, ...whateverElse) {
    console.log(`This is a method. x = ${this.x}, p1 = ${p1}, etc.`);
  }
};

anObject[startMethod]("someMethod", p1, p2, ...whateverElse);
```

The `object[startMethod]` method works exactly the same as `start` function, except that the `someMethod` will be called in context of `this == object`.

## start(mainIteratorOrPromise): _function: 'CoroutineHandle'_ (since 1.4)

- `mainIteratorOrPromise`: _iterator_ or _Promise_ - an iterator created by calling a coroutine generator, or a `Promise` created by calling an `async` function

This version of `start` allows to write launch of a coroutine in more natural manner:

```js
function *generatorBasedMain(a, b, c) { ... }
start(generatorBasedMain(1, 2, 3));
// ^same as start(generatorBasedMain, 1, 2, 3)

async function asyncBasedMain(a, b, c) { ... }
start(asyncBasedMain(1, 2, 3));
// ^same as start(asyncBasedMain, 1, 2, 3)

var obj = {
    generatorMethodBasedMain: function *(a, b, c) { ... },
    asyncMethodBasedMain: function *(a, b, c) { ... }
};

start(obj.generatorMethodBasedMain(1, 2, 3));
// ^same as obj[startMethod]("generatorMethodBasedMain", 1, 2, 3)
start(obj.asyncMethodBasedMain(1, 2, 3));
// ^same as obj[startMethod]("asyncMethodBasedMain", 1, 2, 3)

```

Alas, no similar convenience is possible for plain function/method based coroutines.

## "Magic" pseudo-global variables

In `crtk` there are several special variables: `SYNC`, `SYNCTL`, `SYNCW` and `CRTN`. Semantically, they are global, but via some automagic they only are defined while JS is executing code inside a generator or function that was started as coroutine (via `start` or `Object[startMethod]`), and they are specific to the current coroutine (so they effectively are "coroutine local variables"). For this period they will also hide real globals with same names (if there happen to be any, which we hope is unlikely).

You don't need to import any symbols to access `crtk` pseudo-globals, they will just work on demand.

*NOTE!* Pseudo-globals are *only available* in generator based coroutines.

```js
// myscript.js
// note that we even don't need require("crtk") here

module.exports = function *myScriptMain() {
  setTimeout(SYNC, 500); yield *SYNCW();
}
```

This concept is easy to get used to, as long as you keep some points in mind:

- The pseudo-globals are accessible in code running as a coroutine ONLY. If you call the same functions from a non-coroutine environment, the variables will be undefined (or refer to real globals with same names).

```js
function *fancyFunction() {
  setTimeout(SYNC, 250); yield *SYNCW();
}

start(fancyFunction); // ok
fancyFunction().next(); // CRASH BOOM DISASTER
```

- They are accessible and refer to the same coroutine not just in the coroutine's main function, but as well in nested calls to functions and `yield *`-s to nested coroutine generators.

```js
function *base1() {
  CRTN.bases++;
}

function base2() {
  CRTN.bases++;
}

function *main() {
  CRTN.bases = 0;
  yield *base1();
  base2();
  console.log(`All ${CTRN.bases} of your base are belong to us`);
}
```

- Though they are "variables", do not change them, do not cache in other variables/object fields (`CRTN` is a partial exception to this point), and do not pass outside the coroutine, except for in ways they are officially intended to use. They are managed by the framework, and let them be. For the same reason, don't use them inside nested functions if you intend to use these functions as observers or asynchronous callbacks:

```js
function *coroutine() {
  domElement.onclick = function(e) {
    console.log(`SYNC is ${SYNC}`); // DON'T!!!
    // not that it will cause something fatal, it just won't work:
    // since the handler is called outside a coroutine flow,
    // SYNC will be undefined in it
  };
  ...
}
```

On a good side, programming with `crtk` allows to deliver you from writing many direct callbacks in your code, so it won't be an issue for the most part.

### SYNC: _function(err, result)_

`SYNC` resolves to a function that accepts `(err, result)` parameters. Purpose of this function, referred to as "coroutine continuation", is to resume execution of the current coroutine after it yields with next soonest `yield *SYNCW()`. `err` and `result` parameters passed to the continuation determine the result of `yield *SYNCW()` expression (in the coroutine/generator code flow). Non-null `err` means that the expression will throw the value passed in the `err`. Otherwise, the expression will return the value passed in `result`.

```js
function calculateMe(x, callback) {
  setTimeout(function() {
    if (x == 0) { callback(new Error()); }
    else { callback(x + 1); }
  }, 100);
}

function *test() {
  var value = (calculateMe(1, SYNC), yield *SYNCW()); // 2
  try {
    calculateMe(0, SYNC), yield *SYNCW();
  } catch (e) {
    // e instanceof Error
  }
}
```

Several advanced points you generally don't need to keep in mind, but knowing them can be useful:
- Invocation of callback generated by `SYNC` has no immediate synchronous effect down its caller's stack, resumption of coroutine code will occur asynchronously. Therefore `crtk` backs you up in cases like this:

```js
var flakyService = {
  inProgress: false,
  begin: function begin(callback) {
    if (this.inProgress) {
      throw Error("Hey, previous op has not yet completed!");
    } else {
      this.inProgress = true;
      setTimeout(function() {
        // guess what is the issue here
        callback(null, "VALUABLE RESULT");
        this.inProgress = false;
      }, 1000);
    }
  }
};

function *niftyCoroutine() {
  flakyService.begin(SYNC), yield *SYNCW();
  flakyService.begin(SYNC), yield *SYNCW();
  // ^you would get an error on the 2nd one...
  // luckily, you won't and everything will work as you would expect
}
```

- `SYNC` is a one-shot callback. _The same_ callback instance only does the intended action once, all subsequent calls to it are no-ops.
- After `yield *SYNCW()` is executed the `SYNC` starts referring to _new_ callback instance. Due to previous point, invocation of old callback will not cause coroutine resumption after the new `yield *SYNCW()`, so it is safe from this side.
- `SYNC` can be invoked without yielding the coroutine. In this case next `yield *SYNCW()` will deliver the provided error/value immediately:

```js
function *doATrick() {
  SYNC(null, 42);
  console.log(`Value = ${yield *SYNCW()}`);
}
```

It backs you up in cases like this:

```js
function beginFlakyLoad(url, callback) {
  var item;
  if ((item = cache.get(url))) {
    callback(null, item);
  } else {
    beginLoad(url, function(err, result) {
      if (err) { callback(err); }
      else {
        cache.put(url, result);
        callback(err, result);
      }
    });
  }
}
```

In practice, all these points mean that `crtk`'s `SYNC`/`yield *SYNCW()` flow is protected against typical callback usage errors _from asynchronous service side_: double-trigger, invocation in intermediate service state, and occasional synchronous invocation (i. e. having cases where it is called before the asynchronous starter function returns). So, when using `crtk`, a bunch of possibilities for control flow bugs due to flaky implementation of 3rd party libraries is eliminated in transparent manner.

### SYNCTL: _function(result)_

A ThrowLess version of `SYNC`, resolves to a function of `(result)` signature. Resumes coroutine after next soonest `yield *SYNCW()`, by providing `result` as `yield *SYNCW()` return value. Throw can not occur in this case (except if coroutine is canceled, see `SYNCW` and `'CoroutineHandle'.cancel`).

```js
function beginThrowlessOperation(callback) {
  setTimeout(function () { return 42; }, 500);
}

function *throwlessConsumer() {
  var result = (beginThrowlessOperation(SYNCTL), yield *SYNCW());
  if (result != "error") {
    console.log("Success!");
  }
}
```

Since method of returning async result via single parameter callback is probably even more popular than with error+result callback, `SYNCTL` is a convenience helper to use with such APIs instead of `SYNC`.

All points and details described above for `SYNC` are also applicable to `SYNCTL`.

### SYNCW: _generator([cancelCallback(cancelMsg)])_

This pseudo-global resolves to a helper generator. As mentioned above, expression `yield *SYNCW()` yields the coroutine execution and resumes it when callback obtained by preceding `SYNC` or `SYNCTL` is called.

This strategy holds in almost all cases, except for one forced exception (fortunately quite an exotic one) that you have to remember: _do not use SYNC/SYNCTL under real generators_ (ones that are used as actual generators).

```js
// NO
function *getNextValue() {
  setTimeout(100, SYNC), yield *SYNCW();
  return Math.random();
}

// DON'T
function *generator() {
  for(var i = 0; i < 100; i++) {
    yield (yield *getNextValue()); // it even looks incorrect!
  }
}

// IT WON'T WORK
function *main() {
  for (var x of generator()) {
    console.log(x);
  }
}
```

Because `crtk`'s coroutine framework is implemented on generators, such unnatural restriction unfortunately applies. If you ever need such a strange construct, you'll need to wrap the generator or express the logic without generators.

Another possible outcome for `yield *SYNCW()` is to throw `Cancellation` object if the coroutine is canceled (see `'CoroutineHandle'.cancel`). For case when asynchronous operation you are waiting on provides some explicit cancel facility, `SYNCW` accepts an optional `cancelCallback` parameter. It can be a function of `(cancelMsg)` signature, and it is invoked before throwing `Cancellation`, allowing you to perform some custom cancellation code.

```js
function *cancelAware() {
  var abortableRequest = new AbortableRequest(); // provides .abort method
  var result = (abortableRequest.perform(SYNC),
    yield *SYNCW(function(cancelMsg)
    {
      console.log(`cancelAware canceled for reason: ${cancelMsg}`);
      abortableRequest.abort();
    }));
  ...
}
```

The `cancelMsg` parameter is the cancellation message value provided by caller of `'CoroutineHandle'.cancel`.

`cancelCallback` will only be called if the cancel occurs during this particular `yield *SYNCW()`.

#### .withCancel(cancelCallback): _generator_

- `cancelCallback`: _function(cancelMsg)_

`SYNCW` provides a helper method `.withCancel` for improving code readability. `yield *SYNCW.withCancel(X)` is the same as `yield *SYNCW(X)`:

```js
function *cancelAware() {
  var abortableRequest = new AbortableRequest();
  var result = (abortableRequest.perform(SYNC),
    yield *SYNCW.withCancel(function(cancelMsg)
    {
      console.log(`cancelAware canceled for reason: ${cancelMsg}`);
      abortableRequest.abort();
    }));
  ...
}
```

### CRTN: _'CoroutineHandle'_

This pseudo-global is set to `'CoroutineHandle'` (see below) of the current coroutine. As coroutine handle is a legal value to store and pass around, this pseudo-global is ok to copy into other variables and leak from the coroutine flow. Though you don't normally need this, as in out-of-coroutine places where this value is needed it is generally accessible in other ways.

There are following reasons why coroutine's own handle is accessible via `CRTN` is convenience in following tasks:

- checking if currently running code belongs to a certain coroutine instance (different instances naturally have different handles),
- emission of feedback events (see `'CoroutineHandle'.emit`),
- possibility to cancel self (see `'CoroutineHandle'.cancel`).

And there is one more important use of easy access to own handle: you can use its custom fields as _coroutine local variables_ visible to all the functions/generators down the stack:

```js
function coroutineTimeElapsed() {
  if (CRTN && CRTN.startedAt) {
    return (new Date()).getTime() - CRTN.startedAt.getTime();
  } else {
    throw new Error("Can only invoke this from a properly started coroutine!");
  }
}

function *properlyStartedCoroutine() {
  CRTN.startedAt = new Date();
  setTimeout(SYNC, 1000), yield *SYNCW();
  console.log(`Elapsed ms: ${coroutineTimeElapsed()}`);
}
```

Note that `CRTN` won't be defined (or at least won't refer to the coroutine) from nested functions that are called as callbacks by some external stuff. For this case you will need to cache it in closure variables:

```js
function *trackClicksFor1Sec(clickable) {
  CRTN.clicks = 0;
  var myself = CRTN;
  clickable.on("click", function() {
    myself.clicks++; // _not_ CRTN.clicks++
  });

  setTimeout(1000, SYNC), yield *SYNCW();
}
```

## 'CoroutineHandle': _class_

- implements: `'Awaitable'`
- implements: `'Cancellable'`
- implements: `'Promise-ish'` (since 1.3)

When you start a coroutine via `start` or `startMethod` helpers (see below), value returned by them is an instance of `CoroutineHandle`. This object allows to keep track and sync on coroutine, and to obtain results on its completion. Coroutine (and the `'Awaitable'` it implements) is completed when control flow exits its starting function (returned or thrown).

```js
function *test() { ... }

var crtnHandle = start(test);
// ^the coroutine starting function here is test
```

A coroutine handle can be legally used inside the coroutine itself, where it can be either passed or accessed directly via `CRTN` pseudo-global variable. Such use however requires some extra caution. For example:

```js
function *deadlock() {
  CRTN.await(SYNC); yield *SYNCW();
}
```

is a definitely bad idea.

### .error: _any or undefined_

This field is defined and set to non-false value if coroutine's starting function has ended with leaked throw.

### .result: _any or undefined_

This field is defined if coroutine's starting function has ended with normal return, and is set to its returned value. Only has meaning if `.error` is non-true.

`'CoroutineHandle'`'s `.error` and `.result` are treated as result of the `'Awaitable'` implemented by the handle.

```js
function *failousCrtn() {
  if (Math.random() < 0.5) {
  throw Error("This is a test error");
  } else {
    return 42;
  }
}

var crtnHandle = start(failousCrtn).await(function(err, result) {
  if (crtnHandle.error) {
    console.log(`Coroutine ended in error ${crtnHandle.error}, what a shame`);
  } else {
    console.log(`Coroutine returned ${crtnHandle.result}, what a shame`);
  }
});
```

### .cancel([cancelMsg]): _method_ (as per `'Cancellable'`)

- `cancelMsg`: _any_

Requests the coroutine to cancel. The cancel is enforced by making all subsequent `yield *SYNCW()`-s inside this coroutine (including currently pending one) to end on next soonest asynchronous occasion with throwing `Cancellation` object (see below). If coroutine's `.cancel` is invoked from the coroutine itself, it itself ends synchronously by throwing `Cancellation`.

Throwing semantics allows the coroutine to finalize its cancellation gracefully in natural exception unwinding way.

Remember that no more awaiting for asynchronous operations are allowed in the coroutine after cancellation. If your finalization logic needs ones then you have to start that logic in a new coroutine.

*NOTE!* `.cancel` can be applied to any coroutine handle, but works to a limited degree on `async` function based coroutine: it cancels awaiting of the underlying `async` function, but does not affect the running function itself. There is no official way to pass cancellation to a running `async` function, so if you need it you'll have to invent wheels. Blame ES `async` / `await` / `Promise` design.

### .emit(channel, ...args): _method_

- `channel`: _String_ - event channel ID,
- `args`: list of _any_ - invocation arguments to the listeners

`crtk` provides another tool for cooperating between coroutine and outside world: feedback events. The coroutine code (or anyone who has access to its handle, but in most cases you want it to be the coroutine) can emit an event for some custom indication of its state:

```js
function *longOperationWithProgressReport() {
  for (var i = 0; i < 100; i++) {
    CRTN.emit("progress", i);
    setTimeout(SYNC, 1000), yield *SYNCW();
  }
  CTRN.emit("progress", 100);
}
```

To ease differing events from each other, each event is associated with a certain "event channel" identified by some string (the channel ID). There can be listener callbacks subscribed on this channel (see `.on` and `.once`), and every time the event is emitted on this channel they are invoked (on next soonest asynchronous occasion). Unlike with `'Awaitable'`-s, the events are not persistent: if a listener was not subscribed by time the event is emitted, it won't get it.

No order of calling the listeners is guaranteed, so don't rely on any assumption of their ordering.

Emitting events is not restricted to any coroutine state, it is allowed even when coroutine is cancelled, completed, or its code has not yet been executed (of course in latter two cases the emission is only possible by external helpers from outside the coroutine code). You can actually create a dummy coroutine that does nothing by itself, just to have a free event producer:

```js
function Clickable() {
  var eventProducer = start(function(){});

  this.click = function() {
    eventProducer.emit("click", this);
  };

  this.addOnClickListener = function(callback) {
    eventProducer.on("click", callback);
  };

  return eventProducer;
}
```

Channel IDs do not need to be specially and separately declared, you just use any string you like. Of course it shouldn't conflict with ones already in use. `crtk` by itself reserves no channel IDs, so you are free to start from any one.

### .on(channel, callback): _method_

- `channel`: _String_ - event channel ID,
- `callback`: _function_ - listener callback to be called

Subscribe a listener to the events on channel identified by string `channel`. Whenever `.emit(channel, ...)` is called, the listeners are called. Parameters passed to them are the same as `args` passed by the emitter to `.emit`.

```js
function *pinger() {
  setTimeout(500, SYNC), yield *SYNCW();
  CRTN.emit("ping", "hello");
}

start(pinger).on("ping", function (arg) {
  console.log(`Pinger says ${arg}`);
});
```

`this` context of callback should be assumed undefined (in sense that we can't rely on it assigned any particular value). \[Currently it is global object, but this assumption must not be relied on.\] If you need to call a method, use binding.

Unlike most similar event solutions, `crtk` framework does not pass any extra parameters to handlers to access some sort of the 'event' object. The list of parameters given by an emitter will be passed as is. Similarly, no event bubbling, suppression etc. - just straightforward call of all the listeners. Because simplicity. If needed, this feature can be used as basis for implementing custom, more sophisticated event handling. But if you need no sophistication, it is good as is.

_NOTE_: same subscriber instance can not be subscribed twice, on such attempts second subscription is silently ignored. However, as always in similar cases in JS, be careful when using bound, anonymous or local functions: never forget that a `.bind(...)` or `function(){...}` delivers _new_ instance every time it is calculated, and local function is different on each new call of enclosing function.

### .once(channel, callback): _method_

- `channel`: _String_ - channel ID
- `callback`: _function_ - listener callback to be called

Same as `.on(channel, callback)`, but the `callback` will only be called once, for next soonest event on `channel`, and then auto-unsubscribed. Handy when you need it to behave exactly like this, and particularly useful with anonymous/local/bound functions as one-shot callbacks.

### .removeListener(channel, callback): _method_

- `channel`: _String_ - channel ID
- `callback`: _function_ - listener callback (subscribed earlier)

Remove given listener to the channel. Must be the same instance as used in `.on`/`.once`. Unsubscribing a non-subscribed callback silently does nothing.

Also, the same instance reminder as for `.on`. If you need to remove a listener eventually, cache it first and then use the cached value. Only this way you can be sure it is actually the same instance.

```js
var crtnHandle = start(...);
var handler;
crtnHandle.on("something", handler = function() {
  ...
});
...
crtnHandle.removeListener(handler);
```

### .removeAllListeners(channel): _method_

- `channel`: _String_ - channel ID

Remove all currently subscribed listeners to the given channel.

### Custom members as coroutine local variables

You can use any other members of the `'CoroutineHandle'` as that coroutine's local variables. The coroutine code can access them via `CRTN.memberName` shortcuts (see description of `CRTN` for an example). This is yet another method of communication between the coroutine and its environment.

## Cancellation: _class_

An instance of `Cancellation` is thrown in the coroutine from `yield *SYNCW()` after cancel request to that coroutine is issued. Structure of this object is similar to an instance of `Error` (but it itself is _not_ an instance of `Error`).

`Cancellation` as a value can be checked against by `instanceof` expression to check if an object is an instance of `Cancellation`.

*NOTE*: prior to `crtk` 1.4, `instanceof Cancellation` was only guaranteed to work properly on coroutines started in the same module that does the check.

```js
const Cancellation = require("crtk").Cancellation;

function *test() {
  try {
  } catch (e) {
    if (e instanceof Cancellation) {
      console.log("We were cancelled!");
    } else {
      console.log(`An ordinary error ${e}`);
    }
  }
}
```

Manual construction and throwing of `Cancellation` is intentionally prohibited, in order to ensure consistent 'catching `Cancellation` means that current coroutine is canceled' convention. For the same reason, if you are `.await`-ing on a coroutine that ends by throwing `Cancellation`, a wrapper `Error` is thrown into the awaiter's flow instead of the original `Cancellation`: unhandled cancellation of the awaited coroutine is abnormal result, but it isn't cancellation of the awaiter. However, the original `Cancellation` will still be accessible via `'CoroutineHandle'.error` (and this is the only allowed case for its `.error` to be different from value delivered to `.await`-ing callbacks).

Note: if your coroutine catches `Cancellation`, then won't rethrow it and will finish gracefully without attempting any more `yield *SYNCW()`-s, it will be considered a normal return.

### .message: _any_

Cancellation message. The same value as provided in `cancelMsg` parameter to `'CoroutineHandle'`'s `.cancel`. Possibly a text message (on analogy of `Error`) - will be converted to string on stringification of the `Cancellation` object (see `.toString`). But it actually can be any object or value. Interpretation of the message is up to the coroutine code.

### .stack: _String_

Stack trace of the `yield *SYNCW()` that issued the `Cancellation`. Note that any subsequent `yield *SYNCW()` in the same coroutine throws new `Cancellation` instance with new stack trace, the old instance is discarded (unless you store it manually somewhere).

### .toString(): _String_ (as per `Object`)

Converts the `Cancellation` to string. Similarly to `Error`, the string is "Cancellation: " + `.message`.

## Awaiter: _class_

- implements: `'Awaitable'`
- implements: `'Promise-ish'` (since 1.3)

`Awaiter` is designed as an adapter from callback-based asynchronous result providers to `'Awaitable'`. On one hand, it is a function of `(err, result)` signature that can be used as a callback to accept some asynchronous result. On another hand, it stores the result and is `'Awaitable'` that reflects its obtainment.

```js
const {
  Awaiter
} = require("crtk");

// note that construction of an Awaiter is STRICTLY without 'new'
var awaiter = Awaiter();
```

### (err, result): _function_

`Awaiter` is a function that can be just called. Its signature is usual `(err, result)` where non-false `err` means an error, and `result` means normal result. This result will be delivered further to `.await`-ers.

As well as `SYNC`/`SYNCTL`, `Awaiter` is one-shot function (subsequent calls are no-ops) and has no immediate side effects.

Typical use case is like this:

```js
const unirest = require("unirest"); // https://www.npmjs.com/package/unirest

function *unirestRequest() {
  var delivered = Awaiter();

  unirest.post('http://mockbin.com/request')
  .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
  .send({ "parameter": 23, "foo": "bar" })
  .end(function(response) {
    if(response.statusType != 2) {
        delivered(new Error(`HTTP error: status ${response.status}`));
      } else {
        delivered(null, response.body);
      }
  });

  // that does the trick
  return (delivered.await(SYNC), yield *SYNCW());
}
```

### .error: _any or undefined_

After `Awaiter` is `.done == true` and the result was error, `.error` field will be defined and contain the error object (one provided in `err` parameter when calling `Awaiter` as function).

### .result: _any or undefined_

After `Awaiter` is `.done == true` and the result was a normal result, `.result` field will be defined and contain the result value (one provided in `result` parameter when calling `Awaiter` as function).

## Checkpoint: _namespace Object_

A checkpoint is synchronization tool to address problems like "wait until all of these parallel jobs complete, and then..." It allows to synchronize on group of `'Awaitable'`-s, which can be coroutines, `Awaiter`-s, custom `'Awaitable'`-s, or even other checkpoints. Since 1.4, iterators and `Promise` are allowed too (for purposes of call notation convenience) - they'll be wrapped into `'Awaitable'`-s automatically.

### .allOf(...awaitables): _function: 'CheckpointInstance'_

- `awaitables`: list of _'Awaitable'_ (since 1.4 - or _Promise_, or _iterator_) or _Array_
- return: handle of the created checkpoint instance

"Static" method that creates and returns a `'CheckpointInstance'` object (see below) configured to wait until _all_ of the provided awaitables finish. Each element of `awaitables` must be either an `'Awaitable'` or an array, where each element is either an `'Awaitable'` or an array, where each element is... etc.

In order for `'CheckpointInstance'` to be a consistent `'Awaitable'`, the set of awaitables the checkpoint waits on is fixed on creation and can't be changed later.

```js
function *test() {
var
  sub1 = start(function *() {
    setTimeout(250, SYNC), yield *SYNCW();
    return 100;
  }),
  sub2 = start(function *() {
    setTimeout(500, SYNC), yield *SYNCW();
    return 200;
  }),
  sub3 = start(function *() {
    setTimeout(750, SYNC), yield *SYNCW();
    return 300;
  });

  // wait until sub1, sub2 & sub3 finish
  Checkpoint.allOf(sub1, sub2, sub3).await(SYNC), yield *SYNCW();
  console.log(`And the grand total is ${sub1.result + sub2.result + sub3.result}`);
}
```

`Promise`-s and iterators are assumed to be ones started from an `async` functions and coroutine generators, respectively - they are automatically wrapped into the assumed `'Awaitable'`-s. It allows a less verbose notation for a parallel call:

```js
function *asyncDownload(url) { ... }
async function asyncCheckEmail(email) { ... }

var results = Checkpoint.allOf(
  asyncDownload("http://google.com"),
  asyncDownload("http://www.npmjs.com"),
  asyncDownload("http://github.com"),
  asyncCheckEmail("anonymous@email.net")
).await(SYNC), yield *SYNCW();

// or, if you are writing an async function, even as short as
// var results = await Checkpoint.allOf(...);
```

If no awaitables are provided, the checkpoint is considered finished right away.

### .allIn(awaitables): _function: 'CheckpointInstance'_ (since 1.4)

- `awaitables`: _Array_ or _Dictionary_ (of _'Awaitable'_, _Promise_, _iterator_) or _Array_ - array or associative array of awaitable objects
- return: handle of the created checkpoint instance

A version of `.allOf` that arranges results or errors as an ordered array/dictionary. A result or an error of an `'Awaitable'` will be put under the same key/index in the `.results` or `.errors` (see below) as the `'Awaitable'` was in the `awaitables` array/dictionary.

```js
var resultsAsArray = Checkpoint.allIn([
  asyncGet(ValueA),
  asyncGet(ValueB)
]).await(SYNC), yield *SYNCW();
// resultsAsArray.results = [ result_of_ValueA, result_of_ValueB ]

var resultsAsDictionary = Checkpoint.allIn({
  a: asyncGet(ValueA),
  b: asyncGet(ValueB)
}).await(SYNC), yield *SYNCW();
// resultsAsDictionary.results = { a: result_of_ValueA, b: result_of_ValueB }
```

### .anyOf(...awaitables): _function: 'CheckpointInstance'_

- `awaitables`: list of _'Awaitable'_ (since 1.4 - or _Promise_, or _iterator_) or _Array_
- return: handle of the created checkpoint instance

"Static" method that returns a `'CheckpointInstance'` object configured to wait until _any one_ of the provided awaitables finish. All the other considerations are the same as for `.allOf`.

```js
function *doIt() {
  setTimeout(2000, SYNC), yield *SYNCW.withCancel(function() {
    console.log("Crap! We've busted!");
  });
}

function *doItWithTimeout(x) {
  var task = start(doIt), timeout = Awaiter();
  setTimeout(x, timeout);
  Checkpoint.anyOf(task, timeout).await(SYNC), yield *SYNCW();
  if (!task.done) {
    task.cancel("Hello, the time is up");
  }
}
```

If no awaitables are provided, the checkpoint is considered finished right away.

Note that if checkpoint finishes before all of its `'Awaitable'`-s finish, its results are sealed, and activity and outcomes of remaining `'Awaitable'`-s can no longer affect it. This strategy holds for all cases of early finish, including "stop on first error" mode (see `'CheckpointInstance'.stopOnFirstError`).

`.anyOf` checkpoint type makes use of `'Awaitable'.unawait` methods (where awailable) to clean up its internal callbacks from `'Awaitable'`-s that ended up unused.

### .anyIn(awaitables): _function: 'CheckpointInstance'_ (since 1.4)

- `awaitables`: _Array_ or _Dictionary_ (of _'Awaitable'_, _Promise_, _iterator_) or _Array_ - array or associative array of awaitable objects
- return: handle of the created checkpoint instance

A version of `.anyOf` that arranges results or errors as an ordered array/dictionary. A result or an error of an `'Awaitable'` will be put under the same key/index in the `.results` or `.errors` (see below) as the `'Awaitable'` was in the `awaitables` array/dictionary.

Existing more for symmetry than for actual use (ordering results is a questionable convenience in "any" scenario), `.anyIn` can still be a utility in some specific cases:

```js
function *getAsyncValueWithTimeout() {
  var data = Checkpoint.anyOf({
    result: getAsyncValue(),
    timeout: start(function *() {
      setTimeout(SYNC, 1000), yield *SYNCW();
      return true;
    })
  }).await (SYNC), yield *SYNCW;

  if (data.results.timeout) {
    console.log("Timeout occurred!");
    return null;
  }

  return result;
}
```

## 'CheckpointInstance': _class_

- implements: `'Awaitable'`
- implements: `'Cancellable'`
- implements: `'Promise-ish'` (since 1.3)

The "handle" to actual instance of the checkpoint. Exposes waiting operations and access to the total results.

### .await(callback): _method_

- `callback`: _function(err, result)_ - result notification callback

Await for the configured condition (`allOf` or `anyOf`).
Result of the checkpoint is an instance of `CheckpointResult` (see below). If an error occurs, `CheckpointResult` is delivered as an error, otherwise as a normal result.

```js
function *test() {
  var result;
  try {
    result = (Checkpoint.allOf(...).await(SYNC), yield *SYNCW());
  } catch(e) {
    console.log("Note there was an error!");
    result = e;
  }
}
```

In any outcome, `CheckpointResult` collects errors and results of the involved awaitables. An error of awaiting on the checkpoint itself is scored when at least one of the awaitables ends with an error. Note that some behaviour of the checkpoint in this case is configurable (see `.stopOnFirstError`).

### .cancel([cancelMsg]): _method_

- `cancelMsg`: _any_ - optional cancel message

Cancels the checkpoint. All pending `'Awaitable'`-s which are `Cancellable`-s are canceled as well, with the given cancel message.

Note that calling `.cancel` even after checkpoint has finished is meaningful in `.stopOnFirstError` mode or for `.anyOf` checkpoint type.

### .stopOnFirstError(yes): _method: 'CheckpointInstance'_

- `yes`: _Boolean_ - true if checkpoint must stop on first error, default is `false`
- return: the subject `'CheckpointInstance'`, use for chaining calls

By default, the checkpoint awaits until the whole given set of `'Awaitable'`-s finishes, regardless on which of them ended in error. But this may be not always practical. By setting "stop on first error" mode, you tell the checkpoint to finish after first error occurs.

```js
function *failingOneMakesWaitingForOthersMeaningless() {
  Checkpoint.allOf(start(fastOne), start(slowOne))
  .stopOnFirstError(true)
  .await(SYNC), yield *SYNCW();
}
```

### .cancelAbandoned(yes): _method: 'CheckpointInstance'_

- `yes`: _Boolean_ - true if checkpoint must cancel abandoned awaitables on early finish, default is `false`
- return: the subject `'CheckpointInstance'`, use for chaining calls

On early finish (in `.anyOf` mode or to error of an `'Awaitable'` in `.stopOnFirstError` mode), the remaining unfinished `'Awaitable'`-s are abandoned and normally are left to proceed, though with no effect on the checkpoint. But just leaving them running may not be always desirable. You can enable "cancel abandoned" mode to force automatic cancel if early finish is encountered.

Equivalent to using `.cancelAbandoned` is to use manual `.cancel` on a finished checkpoint.

```js
function *digOrDie() {
  // wait for both, but cancel if any fails
  Checkpoint.allOf(start(diggerOne), start(diggerTwo))
  .stopOnFirstError(true)
  .cancelAbandoned(true)
  .await(SYNC), yield *SYNCW();

  // wait for a success or a failure of any,
  // cancel the other ones as soon as we have an outcome
  Checkpoint.anyOf(start(diggerThree), start(diggerFour))
  .cancelAbandoned(true)
  .await(SYNC), yield *SYNCW();

  // the same as above, but cancel manually
  var checkpoint = Checkpoint.anyOf(start(diggerThree), start(diggerFour))
  .await(SYNC), yield *SYNCW();
  checkpoint.cancel(); // but here we needed a var to store the instance
}
```

### .errors: _Array/Object or undefined_

Read-only. Is `undefined` until the checkpoint is `.done`, then is set to array that contains error values delivered by the `'Awaitable'`-s that have finished with errors. No guarantee on order of the errors is given, nor on the `'Awaitable'`-s they origin from. Use this property if order and origin of errors is not important, or if you are sure the error values contain custom tag information you need.

Since 1.4, if the checkpoint was `allIn` / `anyIn`, the `.errors` will be an array or an object where an error delivered by an `'Awaitable'` will be put under the same key as the `'Awaitable'` was in source array/object. For `'Awaitable'` that completed with no error, the entry under the corresponding key in `.errors` will be set to undefined (but the key itself will still be present).

### .results: _Array/Object or undefined_

Read-only. Is `undefined` until the checkpoint is `.done`, then is set to array that contains result values delivered by the `'Awaitable'`-s that have finished normally. No guarantee on order of the results is given, nor on the `'Awaitable'`-s they origin from, so considerations similar to `.errors` apply.

```js
function *doStuff() {
  var theCheckpoint = Checkpoint.allOf(start(diggerOne), start(diggerTwo));
  try {
    theCheckpoint.await(SYNC), yield *SYNCW();
  } catch(e) {
    if (theCheckpoint.errors.length > 1) {
      // ^normally a redundant check, since if checkpoint failed it means
      // there is at least one error. But remember it can also fail due to
      // coroutine canceled!
      console.log(`There were errors: ${theCheckpoint.errors}`);
    }
  }

  console.log(`Results: ${theCheckpoint.results}`);
}
```

Since 1.4, if the checkpoint was `allIn` / `anyIn`, the `.results` will be an array or an object where a result delivered by an `'Awaitable'` will be put under the same key as the `'Awaitable'` was in source array/object. For `'Awaitable'` that completed with an error, the entry under the corresponding key in `.results` will be set to undefined (but the key itself will still be present).

```js
function *doAnotherStuff() {
    var theCheckpoint = Checkpoint.allIn({
      a: start(getAsyncA),
      b: start(getAsyncB),
      c: start(getAsyncC)
    });
    try {
      theCheckpoint.await(SYNC), yield *SYNCW();
      console.log(`Got a = ${theChecpoint.results.a}`);
      console.log(`Got b = ${theChecpoint.results.b}`);
      console.log(`Got c = ${theChecpoint.results.c}`);
    } catch(e) {
      console.log("There were one or more errors:", theCheckpoint.errors);
    }
}
```

## CheckpointResult: _class_

Instance of this class represents a checkpoint results. Basically it duplicates `'CheckpointInstance'`'s `.errors` and `.results`, but they are delivered in different way which may be more handy. `CheckpointResult` can be delivered:
- as normal asynchronous result of `'CheckpointInstance'.await`, if the checkpoint finishes successfully,
- thrown as error if checkpoint finishes in error.

`CheckpointResult` as a value can be checked against by `instanceof` expression to check if an object is an instance of `CheckpointResult`.

*NOTE*: prior to `crtk` 1.4, `instanceof CheckpointResult` was only guaranteed to work properly if the source `'CheckpointInstance'` was created in the same module that does the check.

```js
const {
  CheckpointResult
} = require("crtk");

function *makeUseOfCheckpointResult() {
  var result;
  try {
    result = (Checkpoint.allOf(start(diggerOne), start(diggerTwo))
      .await(SYNC), yield *SYNCW());
  } catch(e) {
    if (e instanceof CheckpointResult) {
      result = e;
      console.log(`There were errors: ${result.errors}`);
    } else {
      throw e; // not a checkpoint result, throw further
    }
  }

  console.log(`Results: ${result.results}`);
}
```

Manual construction of `CheckpointResult` is intentionally prohibited, and its passing/throwing around is not recommended, in order to ensure logical consistency of checks for it inside `catch` handlers.

### .errors: _Array_

Array of errors. The same as `.errors` of the subject `'CheckpointInstance'` would return.

### .results: _Array_

Array of results. The same as `.results` of the subject `'CheckpointInstance'` would return.

### .stack: _String or undefined_

Stack trace of throwing the `CheckpointResult`. Is only defined if `CheckpointResult` was thrown.

### .toString(): _method: String_

- return: stringified value of the object

Returns stringification of `CheckpointResult` (message of form "CheckpointResult: errors = [...], successes = [...]").

## Promise.prototype: _patched ES class_ (since 1.3)

- implements: `'Awaitable'`

`crtk` exends the native ES `Promise` class with some capabilities. The most important one is that a promise instance is now `'Awaitable'`, and as such it can be used in all use cases involving an `'Awaitable'` object.

```js
// node 7+ only
function *doStuff() {
  async function doAsync() {
    return 100500;
  }

  // since we are not in async function we can't use "await doAsync()", but...
  var asyncResult = (doAsync().await(SYNC), yield *SYNCW());
  console.log(asyncResult); // naturally 100500
}
```

_NOTE!!!_ The extensions only apply to native ES `Promise` (specifically targeting `async` functions). They do not affect foreign promises from `bluebird`, `q` and other written-of-despair promise libraries.

### .error: _any or undefined_

After `Promise` instance is `.done == true` and the result was rejection, `.error` field will be defined and contain the error object (one provided in the promise rejection).

### .result: _any or undefined_

After `Promise` instance is `.done == true` and the result was a success, `.result` field will be defined and contain the result value (one provided in the promise fulfillment).

## NowThen: _class_ (since 1.3)

When writing a coroutine based on an `async` function, the `crtk` pseudo-globals including `SYNC`, `SYNCTL` and `SYNCW` are not available. In order to deal with callback driven functions under this condition, `NowThen` helper is provided. Besides, since 1.4 `NowThen` also provides a number of convenience utilities for control flow.

```js
const {
  NowThen
} = require("crtk");

async function waitFor250Ms() {
  // note that construction of an NowThen is STRICTLY without 'new'
  // it is recommended to create it as a local variable, one per function
  // is enough
  var nt = NowThen();

  await (setTimeout(nt.SYNC, 250), nt.SYNCW);
}

// note it is just an async function with no extra contracts,
// you don't have to call it in a crtk coroutine
// and can just call it "standalone"
var waitingPromise = waitFor250Ms();
```

The pattern works exactly like `crtk`'s standard `SYNC[TL]` / `SYNCW`, just inside an `async` function.

Besides that, since 1.4 `NowThen` also provides a tool to insert a voluntary control yield (allowing some asynchronous code to run) into a long-running synchronous code after a given time slice. This feature can be used in both generator based and `async` function based coroutines.

It is highly recommended to use a single instance of `NowThen` as a local variable only accessible inside the continious call stack of a coroutine function, and mark `try` / `catch` / `finally` clauses using `TRY` / `CATCH` / `FINALLY` helpers (see examples below in the respective section). While this pattern is not a strict "must", it will enable you to make correct use of `NowThen`'s control flow helpers, such as `timeslice*` and `aft`.

### .SYNC: _function(err, result)_

Returns a callback that will resolve or reject promise delivered by next `.SYNCW` of this `NowThen` instance. The callback signature is `(err, result)` where non-false `err` means an error, and `result` means normal result.

### .SYNCTL: _function(err, result)_

'Throwless' version of `.SYNC`, returns a callback that will resolve promise delivered by next `.SYNCW` of this `NowThen` instance. The callback signature is `(result)` where `result` is the returned result.

### .SYNCW: _Promise_

Returns an instance of `Promise` that will be resolved by calling a callback provided by previous `.SYNC` or `.SYNC[TL]` of this `NowThen` instance.

The common use pattern is as described above:

```js
async function userFunction() {
  var nt = NowThen();
  ...
  // function callbackDrivenFunction(..., callback)
  var result = await(callbackDrivenFunction(..., nt.SYNC), nt.SYNCW);
}
```

The pattern above essentially works as `.SYNC[TL]` / `SYNCW` stack: reading these from the same instance can be 'nested', so that `.SYNCW` delivers promises corresponding to correct `.SYNC[TL]`-s even in complex expressions (provided you use the same instance of `NowThen`):

```js
async function userFunction() {
  var nt = NowThen();
  ...
  // function calcSomething(callback, x)
  var result = await(calcSomething(nt.SYNC,
    await (calcSomething(nt.SYNC,
      1), nt.SYNCW)
    + await (calcSomething(nt.SYNC,
      1), nt.SYNCW)), nt.SYNCW);
  // ^async sort of "calcSomething(calcSomething(1) + calcSomething(2))"
}
```

Be sure to always have a `.SYNCW` matching `.SYNC[TL]` as immediately as possible, so that this 'stack' didn't start to grow. There is a subtle issue possible here:

```js
function trickyFunc(callback, i) {
  if (Math.random() % 1) throw Error("hehe");
  setTimeout(function() { callback(null, i + 1); }, 1000);
}

async function userFunction() {
  var nt = NowThen();
  for (var i = 0; i < 100500; i++) {
    try {
      await(trickyFunc(nt.SYNC,
          1 + await(trickyFunc(nt.SYNC, 2), nt.SYNCW)
        ), nt.SYNCW);
    } catch (e) {
      console.log("Error encountered: " + e);
    }
  }
}
```

The `trickyFunc(calback, 2)` can throw before the control gets to outer `nt.SYNCW`, and the outer `nt.SYNC`-s will accumulate in the loop. To avoid this problem, use the `TRY` / `CATCH` / `FINALLY` helper (see below for details):

```js
async function userFunction() {
  var nt = NowThen();
  for (var i = 0; i < 100500; i++) {
    try {
      nt.TRY;
      await(trickyFunc(nt.SYNC,
          1 + await(trickyFunc(nt.SYNC, 2), nt.SYNCW)
        ), nt.SYNCW);
    } catch (e) {
      nt.FINALLY;
      console.log("Error encountered: " + e);
    }
  }
}
```


### .timesliceUsedUp(span): _method: Boolean_ (since 1.4)

- `span`: _Number_ - amount of milliseconds advised for the current synchronous code time slice

This function measures time elapsed since resumption of the current synchronous piece code, and returns `true` if control yield is advised. The yield can be achieved via `.timesliceYield` method (see below, and also the example):

```js
async function asyncFunction() {
  var nt = NowThen();

  for (var i = 0; i < 1000000000; i++) {
    // this synchronous code will attempt to yield every 100 milliseconds
    // of continuous running
    if (nt.timesliceUsedUp(100)) {
      await(nt.timesliceYield); // note timesliceYield is not called as method
    }
  }
}
```

Timeslice counter is reset on every `yield *SYNCW()` (or `await(nt.SYNCW)` in `async` function based coroutine).

```js
// qsort example adapted from https://medium.com/devschacht/nicholas-c-zakas-computer-science-in-javascript-quicksort-afa07c0a47f0
function *quickSortAsync(items) {
  var nt = NowThen();

  // direct use of timesliceUsedUp/timesliceYield every time is a bit verbose,
  // so wrap it into a helper
  function *possiblyYield() {
    if (nt.timesliceUsedUp(100)) {
      nt.timesliceYield.await(SYNC), yield *SYNCW();
    }
  }

  function *partition(left, right) {
      var pivot = items[Math.floor((right + left) / 2)],
          i = left, j = right;
      while (i <= j) {
          while (items[i] < pivot) {
              i++;
              yield *possiblyYield();
          }
          while (items[j] > pivot) {
              j--;
              yield *possiblyYield();
          }
          if (i <= j) {
              swap(items, i, j);
              i++; j--;
              yield *possiblyYield();
          }
      }
      return i;
  }

  function *qsortInner(left, right) {
    var index;
    if (items.length > 1) {
        left = typeof left != "number" ? 0 : left;
        right = typeof right != "number" ? items.length - 1 : right;
        index = yield *partition(left, right);
        if (left < index - 1) {
            yield *quickSortInner(left, index - 1);
        }
        if (index < right) {
            yield *quickSortInner(index, right);
        }
        yield *possiblyYield();
    }

    return items;
  }

  return (yield *qsortInner());
}

...
start(quickSort(items));
```

When using `.timesliceUsedUp` and `.timesliceYield` it is essential that the `NowThen` object was a local variable to the block that constitutes the continuous workflow, otherwise timing calculations will not be correct.

### .timesliceUsedUp: _'Awaitable'_ (since 1.4)

Returns an `'Awaitable'` that can be awaited on to yield the current coroutine and resume it on next asynchronous occasion. Can be used on its own to add a yield point to an otherwise synchronous piece of code, but it can be more productive to combine it with `.timesliceUsedUp` so that you only yield when it gets reasonable.

When using `.timesliceYield` in conjunction with `.timesliceUsedUp`, you must use the same `NowThen` instance, and it is essential that it was a local variable to the block that constitutes the continuous workflow, otherwise timing calculations will not be correct.

### TRY / CATCH / FINALLY:  _void_ (since 1.4)

The `TRY` / `CATCH` /  `FINALLY` is a helper to make up for absence of "try-with-resources" or desctructor concepts in JavaScript. It is supposed to work like this:

```js
const {
  NowThen
} = require('crtk');

async function someFunction() {
  var nt = NowThen();

  try {
    nt.TRY; // first statement in try block - creates a clenaup frame

    var smth = openSomething();
    // adds cleanup code to the clenaup frame
    nt.aft(() => closeSomething(smth));

    smth.blahblahblah();
  } catch (e) {
    nt.CATCH; // first statement in catch block - unwind cleanup frame
  } finally {
    nt.FINALLY; // first statement in finally block - unwind cleanup frame
    // and close it
  }
}
```

`TRY` statement marks beginning of a cleanup frame. `FINALLY` executes the cleanup code pushed in the current cleanup frame (via `aft` method, see below) and closes it. `CATCH` executes the cleanup code, but doesn't close the frame, so more cleanup can be pushed in it between `CATCH` and `FINALLY` to be executed at `FINALLY`.

Cleanup frames can be nested - the cleanup code is pushed into the innermost (current) one:

```js
async function someFunction() {
  var nt = NowThen();

  try {
    nt.TRY;
    var smthOuter = openSomething();
    nt.aft(() => closeSomething(smthOuter));

    for (var i = 0; i < 10; i++) {
      try {
        var smthInner = openSomething();
        nt.aft(() => closeSomething(smthInner));
        smthInner.blahblahblah();
      } catch (e) {
        // this CATCH or FINALLY will execute closeSomething(smthInner),
        // but not the closeSomething(smthOuter) which is pushed to the
        // outer frame
        nt.CATCH;
      } finally {
        nt.FINALLY;
      }
    }
  } catch (e) {
    // only this CATCH or FINALLY will execute closeSomething(smthOuter)
    nt.CATCH;
  } finally {
    nt.FINALLY;
  }
}
```

If there is no `catch` clause, `CATCH` can be omitted. If there is only `catch` and no `finally` however, you should use `FINALLY` in place of `CATCH`:

```js
async function someFunction() {
  var nt = NowThen();

  try {
    nt.TRY;
    var smth = openSomething();
    nt.aft(() => closeSomething(smth));
  } finally {
    nt.FINALLY;
  }

  try {
    nt.TRY;
    var smth = openSomething();
    nt.aft(() => closeSomething(smth));
  } catch(e) {
    // there is only catch here, so use nt.FINALLY
    nt.FINALLY;
  }
}
```

Creation of `NowThen` instance implicitly creates one cleanup frame for convenience, so even if you have no `try` / `catch` / `finally` you can still make use of the cleanup, just don't forget to finalize the scope with `FINALLY`:

```js
async function someFunction() {
  var nt = NowThen();

  var smth = openSomething();
  nt.aft(() => closeSomething(smth));

  smth.blahblahblah();

  nt.FINALLY; // note however, this way the statement and hence the cleanup code
  // won't execute if an exception is thrown in between; if your code is not
  // exception safe you should wrap it into try/finally as in examples above
}
```

There are some points to keep in mind when using `TRY` / `aft` / `CATCH` / `FINALLY` feature:

1) You must (naturally) call them all on the _same_ `NowThen` instance.

```js
async function someFunction() {
  var nt = NowThen(),
    nt2 = NowThen();
    // note that having 2nd NowThen instance in the scope is actually bad idea

  try {
    nt.TRY;
    var smth = openSomething();
    nt.aft(() => closeSomething(smth));

    try {
      nt.TRY; // correct, provided that you mean a nested scope
      // nt2.TRY; - NOT correct
    } finally {
      nt.FINALLY;
    }

  } catch (e) {
    nt.CATCH; // correct
    //nt2.CATCH; - NOT correct
  } finally {
    nt.FINALLY; // correct
    //nt2.CATCH; - NOT correct
  }
}
```

2) The `NowThen` instance must only be used by the code that is linked with its declaration scope in a continuous call stack. I. e.:

```js
async function someFunction() {
  var nt = NowThen();

  // this function...
  async function f1() {
    try {
      open();
      nt.aft(() => close());
    } finally {
      nt.FINALLY;
    }
  }
  // ...is called in pseudo-synchronous way and is therefore executed
  // within the current call stack - it is ok for it to use the outer nt
  await(f1());

  // this function...
  async function f2() {
    var nt = NowThen(); // (note this!)
    try {
      open();
      nt.aft(() => close());
    } finally {
      nt.FINALLY;
    }
  }
  // ...is executed asynchronously, and therefore outside the current call
  // stack - it MUST NOT use the outer nt and must declare its own
  start(f2());

  // it never hurts though to create an inner instance of nt, even if one
  // is not necessarily needed - and it is possibly better to adhere to that way
  // to keep uniform
  // the more so different NowThen instances have no effect on each other
  async function f1_1() {
    var nt = NowThen();
    try {
      open();
      nt.aft(() => close());
    } finally {
      nt.FINALLY;
    }
  }
  await(f1_1());

  nt.FINALLY;
}
```

If you get a grasp on how all this works altogether, you can combine the statements in less verbose and orthodox way, provided you understand the caveats:

```js
async function someFunction() {
  var nt = NowThen();
  for (var i = 0; i < 10; i++) {
    nt.TRY;
    var smthI = openSomething(i);
    nt.aft(() => closeSomething(smthI));

    for (var j = 0; j < 10; j++) {
      nt.TRY;
      var smthJ = openSomething(i);
      nt.aft(() => closeSomething(smthJ));

      smthI.blahblahblah();
      smthJ.blahblahblah();
      nt.FINALLY;
    }
    nt.FINALLY;
  }

  //...but if an exception flies through, it will be sad
}
```

Note that, although the examples above are for `async` functions, the `TRY` / `CATCH` / `FINALLY` feature can be used in generator based coroutines as well, and actually even in normal functions without any asynchronous code.

### .aft(dtor): _method_ (since 1.4)

- dtor: _Function_ - a cleanup code to push

Pushes a cleanup code (a function, most typically a lambda expression) into the current cleanup frame that will be called on this frame's `CATCH` or `FINALLY`.

Things to keep in mind:

- the cleanup code must be a plain, non-async, non-generator function. The cleanup is always executed synchronously. If you have to do await for something asynchronous as part of cleanup agenda, start a coroutine from the cleanup code and (if needed) leverage `Awaiter` or `Checkpoint` in the main flow to sync with cleanup coroutine(s).
- the cleanup functions will be executed in the reverse order (to which they were pushed in).

```js
async function someFunction() {
  var nt = NowThen();
  nt.aft(() => console.log("1"));
  nt.aft(() => console.log("2"));
  nt.aft(() => console.log("3"));

  nt.FINALLY; // 3 2 1
}
```

- all of the functions pushed to the frame will be attempted to run exactly once, even if some of them throws an uncaught exception; that exception however will be noted and re-thrown after `CATCH` or `FINALLY` statement completes. If multiple exceptions are accumulated at that point, only one of them will be re-thrown and others will be lost.
- a function pushed to the frame by a single `.aft` is one-shot - once called in `CATCH`, it won't re-execute at `FINALLY`.

```js
async function someFunction() {
  var nt = NowThen();
  try {
    nt.aft(() => console.log("1"));
    ...
  } catch (e) {
    nt.CATCH; // 1
  } finally {
    nt.FINALLY; // 1 here only if there has been no exception
  }
}
```
