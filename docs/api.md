## Foreword about notation

- Identifier in single quotes (`'LikeThis'`) means that no class, symbol, field, variable/constant, prototype, nor other solid JS meta-entity correspond to this value, this is an "anonymous" object just given a convenience name for description purposes.
- Identifier with no quotes (`LikeThis`) refers to a value, a variable or a property that is stored under a name and can be accessed in some way, or to a JS keyword.

## 'Awaitable': _interface_

`'Awaitable'` interface represents an operation with a deferred result and provides interface for interested consumer(s) to access it when ready. Conceptual difference from a Promise is that `'Awaitable'` represents an already running operation, there can be multiple consumers to its result, and they can be subscribed at any moment - including when the operation has completed.

An object compliant with `'Awaitable'` interface must provides the following fields and meet following requirements:

### .await(callback): _method_

- `callback`: _function(err, result)_ - result notification callback

Subscribe a consumer to await the operation result. Result will be delivered by calling the `callback`. If operation delivers an error, the `err` parameter will contain a non-false value (an instance of `Error` for example), otherwise `result` parameter will contain the operation result value.

There can be multiple subscribers awaiting, and it is legal to call `.await` at any time. `'Awaitable'` compliance requires that invocation of any `.await`-ing callback is guaranteed (any exactly once) after the result is available, regardless on whether they were subscriber before or after actual completion. In the latter case a callback will be called on next soonest asynchronous occasion.

### .done: _Boolean_

Read-only property that is `false` when an operation is still running or `true` when it has completed and the result available.

Sets to `true` just before a notification callback is called, therefore is always seen as `true` from callbacks code.

## 'Cancellable': _interface_

- extends: `'Awaitable'`

`'Cancellable'` represents an `'Awaitable'` operation that can be canceled. Meaning, agenda and consequences of cancellation are up to particular implementor.

An object compliant with `'Cancellable'` interface must provides the following fields and meet following requirements:

### .cancel([cancelMsg]): _method_

- `cancelMsg`: _any_ - optional extra cancellation message

Initiate the cancel. Actual cancellation operations do not need to be performed synchronously, `.cancel` may only initiate them. However, the following requirements must be met.

First, `Cancellable` assumes that an operation can only be canceled once, and cancellation is irrevertible, but `.cancel` must be always safe to call. Therefore, to comply with `Cancellable`, the implementor must ensure that 2nd and subscequent calls to `.cancel` are no-ops.

Second, whatever the cancel means, the requirement is to not prevent the `'Awaitable'` from normal way of indicating completion (with `.done = true` and invocation of callbacks). Implementor may deliver cancel case as a special error.

Cancel request may come with an attached cancellation message, specified by the canceler in `cancelMsg` argument. Use and meaning of this parameter are up to the implementor.

## start(mainFunction, ...args): _function: 'CoroutineHandle'_

- `mainFunction`: _generator_ or _function_ - the coroutine main function
- `args`: list of _any_ - arguments to pass to the coroutine main function

The function starts a coroutine that executes given function.

In most cases you want to pass a generator for `mainFunction` to pass a generator for function, as you can use yield in meaning of "wait for asynchronous result" (see `SYNC`/`SYNCTL` and `SYNCW`). However, usual function is allowed too. The logic of coroutine framework will be the same in either case, the code of a plain function will just be not able to leverage yielding.

```js
const start = require("crtk");

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

`start` returns a coroutine handle, object that allows to control and synchronize on the coroutine. See `'CoroutineHandle'` for more info.

Coroutine code will start actual execution on next soonest asynchronous occasion. Note that, from coroutine perspective, pending asynchronous calls (including code from other coroutines) can be called during `yield *SYNCW()` statement.

## startMethod: _Symbol_

In order to allow starting coroutines from objects methods, `Object` prototype is extended with a special helper method, accessible via `Symbol` `startMethod`:

```js
const startMethod = require("crtk").startMethod;
```

### Object[startMethod] (methodId, ...args): _method: 'CoroutineHandle'_

- `methodId`: _string_ or _Symbol_ - id of the method
- `args`: list of _any_ - parameters to pass to the method

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

## "Magic" pseudo-global variables

In `crtk` there are several special variables: `SYNC`, `SYNCTL`, `SYNCW` and `CRTN`. Semantically, they are global, but via some automagic they only are defined while JS is executing code inside a generator or function that was started as coroutine (via `start` or `Object[startMethod]`), and they are specific to the current coroutine (so they effectively are "coroutine local variables"). For this period they will also hide real globals with same names (if there happen to be any, which we hope is unlikely).

You don't need to import any symbols to access `crtk` pseudo-globals, they will just work on demand.

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

- They are accessible and refer to the same coroutine not just in coroutine main function, but as well in nested calls to functions and coroutine generators (via `yield *`).

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

- Though they are "variables", do not change them, do not cache in other variables/object fields (`CRTN` is a partial exception to this point), and do not pass outside the coroutine, except for in ways they are officially intended for use. They are managed by the framework, and let them be. For the same reason, don't use them inside nested functions if you intend to use these functions as observers or asynchronous callbacks:

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

On a good side, programming with `crtk` allows to get rid of many callbacks in your code.

### SYNC: _function(err, result)_

`SYNC` resolves to a function that accepts `(err, result)` parameters. Purpose of this function, referred to as "coroutine continuation", is to resume execution of the current coroutine after it yields with next soonest `yield *SYNCW()`. `err` and `result` parameters passed to the continuation determine the result of `yield *SYNCW()` expression (in the coroutine/generator code flow). Non-null `err` means that the expression will throw the value passed in the `err`. Otherwise, the expression will return the value passed in `result`.

```js
function calculateMe(x, callback) {
  setTimeout(function() {
    if (x == 0) { callback(new Error()); }
    else { callback(x + 1); }
  }
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
- Invocation of `SYNC` has no immediate synchronous effect down its caller's stack, resumption of coroutine code will occur asynchronously. Therefore `crtk` backs you up in cases like this:

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
  // ^you would get an error... luckily, you won't and everything will work
  // as you would expect
}
```

- `SYNC` is a one-shot callback. _The same_ callback instance only does the intended action once, all subsequent calls to it are no-ops.
- After `yield *SYNCW()` is executed the `SYNC` starts referring to _new_ callback instance. Due to previous point, invocation of old callback will not cause coroutine resumption on the new `yield *SYNCW()`, so it is safe from this side.
- `SYNC` can be invoked without yielding the coroutine. In this case next `yield *SYNCW()` will deliver the provided values immediately:

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

In practice, all these points mean that `crtk`'s `SYNC`/`yield *SYNCW()` flow is protected against typical callback usage errors _from asynchronous service side_: double-trigger, invocation in intermediate service state, and synchronous invocation. So, when using `crtk`, a bunch of possibilities for control flow bugs due to flaky implementation of 3rd party libraries is eliminated in transparent manner.

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

This strategy holds in almost all cases, except for one forced exception (fortunately quite an exotic one) that you have to remember: _do not use SYNC/SYNCTL under real generators_.

```js
// NO
function *getNextValue() {
  setTimeout(100, SYNC), yield *SYNCW();
  return Math.random();
}

// DON'T
function *generator() {
  for(var i = 0; i < 100; i++) {
    yield (yield *getNextValue()); // even looks incorrect!
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

Another possible outcome for `yield *SYNCW()` is to throw `Cancellation` object if the coroutine is canceled (see `'CoroutineHandle'.cancel`). For case of asynchronous operation you are waiting on provides some explicit cancel facility, `SYNCW` accepts an optional `cancelCallback` parameter. It can be a function of `(cancelMsg)` signature, and it is invoked before throwing `Cancellation`, allowing you to perform some custom cancellation code.

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

`cancelCallback` won't be called if the cancel does not occur during this `yield *SYNCW()`. But, if it is called, `cancelMsg` parameter is the cancellation message value provided by caller of `'CoroutineHandle'.cancel`.

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

`'CoroutineHandle'`'s `.error` and `.result` are treated as result of the `'Awaitable'` implemented by the coroutine.

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

Remember that no more awaiting for asynchronous operations are allowed in the coroutine after cancellation. If your finalization logic needs ones you have to start that logic in a new coroutine.

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

There can be listener callbacks subscribed on this channel (see `.on` and `.once`), every time the event is emitted on this channel they are invoked (on next soonest asynchronous occasion). Unlike with `Awaitable`-s, the events are not persistent: if a listener was not subscribed by time the event is emitted, it won't get it.

No order of calling the listeners is guaranteed, so don't rely on any assumption of their ordering.

Emitting events is not restricted to any coroutine state, it is allowed even when coroutine is cancelled, completed, or its code has not yet been executed (of course in latter two cases the emission is possible only by external helpers). You can actually create a dummy coroutine that does nothing by itself, just to have a free event producer:

```js
function Clickable() {
  var eventProducer = start(function(){});

  this.click = function() {
    eventProducer.emit("click", this);
  };

  this.addOnClickListener = function(callback) {
    eventProducer.on("click", callback);
  };
}
```

Channel IDs do not need to be specially and separately declared, you just use any string you like. Of course one that doesn't conflict with ones already in use. `crtk` by itself reserves no channel IDs, so you are free to start from any one.

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

`this` context of callback should be assumed undefined. \[Currently it is global object, but this assumption must not be relied on.\] If you need a method, use binding.

Unlike most similar event solutions, `crtk` framework does not pass any extra parameters to handlers to access some sort of the 'event' object. The parameters set given by an emitter will be provided as is. Similarly, no event bubbling, suppression etc. - just straightforward call of all the listeners. Because simplicity. If needed, this feature can be used as basis for manual implementation of more sophisticated event handling. But if you need no sophistication, it is good as is.

_NOTE_: same subscriber instance can not be subscribed twice, on such attempts second subscription is silently ignored. However, as always in similar cases in JS, be careful when using bound, anonymous or local functions: never forget that a `.bind(...)` or `function(){...}` delivers _new_ instance every time it is calculated, and local function is different on each new call of enclosing function.

### .once(channel, callback): _method_

- `channel`: _String_ - channel ID
- `callback`: _function_ - listener callback to be called

Same as `.on(channel, callback)`, but the `callback` will only be called once, for next soonest event on `channel`, and then auto-unsubscribed. Handy when you need exactly this behaviour.

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

Manual construction and throwing of `Cancellation` is not recommended, in order to ensure consistent 'catching `Cancellation` means that current coroutine is canceled' convention. For the same reason, if you are `.await`-ing on a coroutine that ends by throwing `Cancellation`, a wrapper `Error` is thrown into the awaiter's flow instead of the original `Cancellation`: the awaited coroutine canceled is abnormal result, but it isn't cancellation of the awaiter. However, the original `Cancellation` will still be accessible via `'CoroutineHandle'.error` (and this is the only allowed case for its `.error` to be different from value delivered to `.await`-ing callbacks).

Note: if your coroutine catches `Cancellation`, then won't rethrow it and finish gracefully without attempting `yield *SYNCW()`-s, it will be considered a normal return.

### .message: _any_

Cancellation message. The same value as provided in `cancelMsg` parameter to `'CoroutineHandle'`'s `.cancel`. Possibly a text message (on analogy of `Error`) - will be converted to string on stringification of the `Cancellation` object (see `.toString`). But it actually can be any object or value. Interpretation of the message is up to the coroutine code.

### .stack: _String_

Stack trace of the `yield *SYNCW()` that issues the `Cancellation`. Note that any subsequent `yield *SYNCW()` in the same coroutine throws new `Cancellation` instance with new stack trace.

### .toString(): _String_ (as per `Object`)

Converts the `Cancellation` to string. Similarly to `Error`, the string is "Cancellation: " + `.message`.

## Awaiter: _class_

- implements: `'Awaitable'`

`Awaiter` is designed as an adapter from callback-based asynchronous result providers to `Awaitable`. On one hand, it is a function of `(err, result)` signature that can be used as a callback to accept some asynchronous result. On another hand, it stores the result and is `Awaitable` that reflects its obtainment.

```js
const {
  Awaiter
} = require("crtk");

// note that construction of an Awaiter is without 'new'
var awaiter = Awaiter();
```

### (err, result): _function_

`Awaiter` is a function that can be just called. Its signature is usual `(err, result)` where non-false `err` means an error, and `result` means normal result. This result will be delivered further via `.await`.

As well as `SYNC`/`SYNCTL`, `Awaiter` is one-shot function (subsequent calls are no-ops) and has no immediate side effects.

Typical use is like this:

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

A checkpoint is synchronization tool to address problems like "wait until all of these parallel jobs complete, and then..." It allows to synchronize on group of `Awaitable`-s, which can be coroutines, `Awaiter`-s, custom `Awaitable`-s, or even other checkpoints.

### .allOf(...awaitables): _function: 'CheckpointInstance'_

- `awaitables`: list of _Awaitable_ or _Array_

"Static" method that creates and returns a `'CheckpointInstance'` object (see below) configured to wait until _all_ of the provided awaitables finish. Each element of `awaitables` must be either an `Awaitable` or an array, where each instance is either an `Awaitable` or an array... etc.
In order for `'CheckpointInstance'` to be a consistent `Awaitable`, the set of awaitables checkpoint waits on is fixed on creation and can't be changed later.

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

If no awaitables are provided, the checkpoint is considered finished right away.

### .anyOf(...awaitables): _function: 'CheckpointInstance'_

- `awaitables`: list of _Awaitable_ or _Array_

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

Note that if checkpoint finishes before all of its `Awaitable`-s finish, its results are sealed, and activity and outcomes of remaining `Awaitable`-s are ignored. This strategy holds for all cases of early finish, including "stop on first error" mode (see `'CheckpointInstance'.stopOnFirstError`).

## 'CheckpointInstance': _class_

- implements: `'Awaitable'`
- implements: `'Cancellable'`

The "handle" to actual instance of the checkpoint. Exposes waiting operations and access to the total results.

### .await(callback): _method_

- `callback`: _function(err, result)_ - result notification callback

Await for the configured condition (`allOf` or `anyOf`).
Result of the checkpoint is an instance of `CheckpointResult` (see below). If an error occurs, it is delivered as an error, otherwise as a normal result.

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

Cancels the checkpoint. All pending `Awaitable`-s which are `Cancellable`-s are canceled as well, with the given cancel message.

Note that calling `.cancel` even after checkpoint has finished is meaningful in `.stopOnFirstError` mode or for `.anyOf` checkpoint type.

### .stopOnFirstError(yes): _method: 'CheckpointInstance'_

- `yes`: _Boolean_ - true if checkpoint must stop on first error, default is `false`
- return: the subject `'CheckpointInstance'`, use for chaining calls

By default, the checkpoint awaits until the whole given set of `Awaitable`-s finishes, regardless on which of them ended in error. But this may be not always practical. By setting "stop on first error" mode, you tell the checkpoint to finish after first error occurs.

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

On early finish (in `.anyOf` mode or to error of an `Awaitable` in `.stopOnFirstError` mode), the remaining unfinished `Awaitable`-s are abandoned and normally are left to proceed to no effect on the checkpoint. But just leaving them running may not be always desirable. You can enable "cancel abandoned" mode to force automatic cancel if early finish is encountered.

An alternative to using `.cancelAbandoned` is to use manual `.cancel` on a finished checkpoint.

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
  checkpoint.cancel();
}
```

### .errors: _Array or undefined_

Read-only. Is `undefined` until the checkpoint is `.done`, then is set to array that contains error values delivered by the `Awaitable`-s that have finished with errors. No guarantee on order of the errors is given, nor on the `Awaitable`-s they origin from. Use this property if order and origin of errors is not important, or if you are sure the error values contain custom tag information you need.

### .results: _Array or undefined_

Read-only. Is `undefined` until the checkpoint is `.done`, then is set to array that contains result values delivered by the `Awaitable`-s that have finished normally. No guarantee on order of the results is given, nor on the `Awaitable`-s they origin from, so considerations similar to `.errors` apply.

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

## CheckpointResult: _class_

Instance of this class represents a checkpoint results. Basically it duplicates `'CheckpointInstance'`'s `.errors` and `.results`, but they are delivered in different way which may be more handy. `CheckpointResult` can be delivered:
- as normal asynchronous result of `'CheckpointInstance'.await`, if the checkpoint finishes successfully,
- thrown as error if checkpoint finishes in error.

`CheckpointResult` as a value can be checked against by `instanceof` expression to check if an object is an instance of `CheckpointResult`.

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

Manual construction and passing/throwing `CheckpointResult` around is not recommended, in order to ensure logical consistency of checks for it inside `catch` handlers.

### .errors: _Array_

Array of errors. The same as `.errors` of the subject `'CheckpointInstance'` would return.

### .results: _Array_

Array of results. The same as `.results` of the subject `'CheckpointInstance'` would return.

### .stack: _String or undefined_

Stack trace of throwing the `CheckpointResult`. Is only defined if `CheckpointResult` was thrown.

### .toString(): _method: String_

Returns stringification of `CheckpointResult` (message of form "CheckpointResult: errors = [...], successes = [...]").
