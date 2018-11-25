//
// Generator based coroutine toolkit
//

const IS_BROWSER = typeof(window) != 'undefined';
const GLOBAL = IS_BROWSER ? window : global;
const $crtkMajorTag = Symbol.for("@crtk-1.*"),
	$crtkMinorTag = 4, // 1.4
	$crtkVersion = (GLOBAL[$crtkMajorTag] || (GLOBAL[$crtkMajorTag] = {}));
if (+$crtkVersion["latest"] >= $crtkMinorTag) {
	// same or an elder minor version already imported, use it rather than self
	module.exports = $crtkVersion[$crtkVersion["latest"]];
	return;
} else {
	// we are the oldest
	$crtkVersion[$crtkMinorTag] = module.exports;
	$crtkVersion["latest"] = $crtkMinorTag;
}

const $cancelled = Symbol(),
	$cancelMsg = Symbol(),
	$completed = Symbol(),
	$result = Symbol(),
	$error = Symbol(),
	$resultAvailable = Symbol(),
	$theIterator = Symbol(),
	$awaiters = Symbol(),
	$eventListeners = Symbol(),
	$onIteratorDone = Symbol(),
	Generator = Object.getPrototypeOf(function *(){}).constructor,
	// ^for instanceof check
	startMethod = module.exports.startMethod = Symbol();

const execAsync = IS_BROWSER ?
function execAsync(callback, ...args) {
	setTimeout(callback.bind.apply(callback, [GLOBAL, ...args]), 0);
} :
function execAsync(callback, ...args) {
	process.nextTick(callback.bind.apply(callback, [GLOBAL, ...args]));
};

const PROMISE_AVAILABLE = (typeof(Promise) != 'undefined');

//
// some cross-version helper exports
//

// expose symbol for cross-version "instanceof Cancellation" check
// (both these objects should stay strictly empty in future versions)
const GCancellation = module.exports.Cancellation =
($crtkVersion['Cancellation'] ||
($crtkVersion['Cancellation'] = function Cancellation() {
	if ($crtkVersion['CancellationInstance']) {
		throw new Error("Manual construction of Cancellation is prohibited");
	}
}));
const GCancellationInstance = $crtkVersion['CancellationInstance'] ||
($crtkVersion['CancellationInstance'] = new GCancellation());

// and similarwise for "instanceof CheckpointResult"
const GCheckpointResult = module.exports.CheckpointResult =
($crtkVersion['CheckpointResult'] ||
($crtkVersion['CheckpointResult'] = function CheckpointResult() {
	if ($crtkVersion['CheckpointResultInstance']) {
		throw new Error("Manual construction of CheckpointResult is prohibited");
	}
}));
const GCheckpointResultInstance = $crtkVersion['CheckpointResultInstance'] ||
($crtkVersion['CheckpointResultInstance'] = new GCheckpointResult());

const $timesliceStartedAt = ($crtkVersion['timesliceStartedAt'] ||
($crtkVersion['timesliceStartedAt'] = Symbol()));


//
// Cancellation
//

const Cancellation = function Cancellation(msg) {
	this.__proto__ = GCancellationInstance;
	this.message = msg;
	this.stack = new Error().stack;
	this.toString = function toString() {
		return "Cancellation: " + msg;
	};
}

//
// Promisification of awaitable
//

const $awaiterPromise = Symbol(),
	$doBeforeEnterPromise = Symbol(); // helper for NowThen
function ensureBackingPromise(awaitable) {
	var result = awaitable[$awaiterPromise];
	if (!result) {
		result = awaitable[$awaiterPromise] = new Promise(
			function(accept, reject) {
				awaitable.await(function (e, r) {
					var doBefore = awaitable[$doBeforeEnterPromise];
					if (doBefore) {
						doBefore();
					}
					if (e) {
						reject(e);
					} else {
						accept(r);
					}
				});
			});
	}

	return result;
}

function maybePromisifyAwaitable(awaitable) {
	if (PROMISE_AVAILABLE) {
		awaitable.then = function(...args) {
			return ensureBackingPromise(awaitable).then(...args);
		}
		awaitable.catch = function(...args) {
			return ensureBackingPromise(awaitable).catch(...args);
		}
	}

	return awaitable;
}

//
// start and the core stuff
//

var CheckpointResult;
const start = module.exports.start =
function start(gFunc, ...theArgs) {
	// prechecks
	var isIterator = false;
	if (typeof(gFunc.next) == 'function') {
		// an iterator is picked up directly, prepare it
		gFunc[$onIteratorDone] || (gFunc[$onIteratorDone] = Awaiter());
		isIterator = true;
		// ^awaiter be pushed on completion by coroutine implementation, see below
	} else if (typeof(gFunc.then) == 'function') {
		// a promise wraps into generator
		var toWaitWrapped = Awaiter();
		gFunc.then(function (r) {
				toWaitWrapped(null, r);
			}, function (e) {
				toWaitWrapped(e);
			});
		gFunc = function *promiseWrapper() {
			return (toWaitWrapped.await(SYNC), yield *SYNCW());
		}
	}

	if (typeof(gFunc) != 'function' && !isIterator) {
		throw new TypeError("Can only start with a function, async function, a generator function, an iterator, or a promise");
	}
	if (gFunc.constructor.name == 'AsyncFunction') {
		// NJS7+ async function wraps into generator
		var bindTo = this, func = gFunc;
		gFunc = function *asyncFuncWrapper() {
			// make use of assumption the Promise is patched by our await
			return (func.apply(bindTo, theArgs).await(SYNC), yield *SYNCW());
		};
	} else if (!isIterator && !(gFunc instanceof Generator)) {
		// plain function wraps into generator
		var bindTo = this, func = gFunc;
		gFunc = function *plainFuncWrapper() {
			return func.apply(bindTo, theArgs);
		};
	} // otherwise it already is a generator, not wrapping

	var first = true,curSyncr, onceListeners = null;
	function getOnceListenersFor(channel) {
		return (onceListeners || (onceListeners = {}))
			[channel] || (onceListeners[channel] = new Set());
	}

	// Cancellation as result of a coroutine is wrapped into Error
	// with the same stack
	function possiblyWrapCancellationResult(e) {
		if (e instanceof GCancellation) {
			return Object.assign(new Error("Coroutine canceled - " + e),
				{ stack: e.stack });
		} else {
			return e;
		}
	}

	var thisCrtn = {
		[$cancelled]: false, // stop initiated
		[$cancelMsg]: null,
		[$completed]: false, // execution completed
		[$result]: null,
		[$error]: null,
		[$resultAvailable]: false,
		[$theIterator]: null,
		[$awaiters]: null,
		[$eventListeners]: null,
		await: function await(callback) {
			if (!(callback instanceof Function)) {
				throw new TypeError("Callback must be a function");
			}
			if (curSyncr && callback == curSyncr) {
				throw new TypeError("Awaiting self not allowed");
			}
			if (thisCrtn[$completed]) {
				// already completed, so just trigger the stuff
				execAsync(callback, possiblyWrapCancellationResult(thisCrtn[$error]),
					thisCrtn[$result]);
			}
			else {
				// still working - put on queue
				var awaiters = thisCrtn[$awaiters] ||
					(thisCrtn[$awaiters] = new Set());
				awaiters.add(callback);
			}
		},
		unawait: function unawait(callback) {
			thisCrtn[$awaiters] && thisCrtn[$awaiters].delete(callback);
		},
		cancel: function cancel(cancelMsg) {
			if (!thisCrtn[$cancelled]) {
				thisCrtn[$cancelled] = true;
				thisCrtn[$cancelMsg] = cancelMsg;
				if (!thisCrtn[$completed]) {
					if (GLOBAL.CRTN!=thisCrtn) {
						// crt not completed and we're somewhere outside -
						// push signal to it
						execAsync(function()
						{ curSyncr && curSyncr(null, null); });
					} else {
						// we are inside the crt code, proceed immediately
						throw new Cancellation(cancelMsg);
					}
				}
			}
		},
		get done() {
			return thisCrtn[$completed];
		},
		get result() {
			return thisCrtn[$completed] ? thisCrtn[$result] : undefined;
		},
		get error() {
			return thisCrtn[$completed] ? thisCrtn[$error] : undefined;
		},

		on: function on(channel, listener) {
			channel = channel.toString();
			var eventListeners = thisCrtn[$eventListeners] ||
				(thisCrtn[$eventListeners] = new Object()),
				channelListeners = eventListeners[channel] ||
					(eventListeners[channel] = new Set());
			channelListeners.add(listener);
		},

		once: function once(channel, listener) {
			thisCrtn.on(channel, listener);
			getOnceListenersFor(channel).add(listener);
		},

		removeListener: function removeListener(channel, listener) {
			channel = channel.toString();
			var eventListeners = thisCrtn[$eventListeners] ||
				(thisCrtn[$eventListeners] = new Object()),
				channelListeners = eventListeners[channel] ||
					(eventListeners[channel] = new Set());
			channelListeners.delete(listener);
			var channelOnceListeners;
			if(onceListeners && (channelOnceListeners = onceListeners[channel])) {
				channelOnceListeners.delete(listener);
			}
		},

		removeAllListeners: function removeAllListeners(channel) {
			thisCrtn[$eventListeners] && (delete thisCrtn[$eventListeners][channel]);
			if(onceListeners) {
				delete onceListeners[channel];
			}
		},

		emit: function emit(channel, ...args) {
			channel = channel.toString();
			var listeners = thisCrtn[$eventListeners] &&
				thisCrtn[$eventListeners][channel],
				channelOnceListeners = onceListeners && onceListeners[channel];
			if (listeners) {
				for (var listener of listeners) {
					execAsync(listener, ...args);
					if (channelOnceListeners && channelOnceListeners.has(listener)) {
						this.removeListener(channel, listener);
					}
				}
			}
		}

	};
	var yieldCount = 0; // just a counter for fun

	function *SYNCW(cancellationCallback)
	{
		if (!thisCrtn[$resultAvailable] && !thisCrtn[$cancelled]) {
			yield yieldCount++;
		}
		if (thisCrtn[$cancelled]) {
			cancellationCallback && cancellationCallback(thisCrtn[$cancelMsg]);
			throw new Cancellation(thisCrtn[$cancelMsg]);
		}
		thisCrtn[$resultAvailable] = false; // we are going to use it up
		if (thisCrtn[$error]!=null) {
			var e = thisCrtn[$error], stack = (new Error().stack);
			if (e instanceof GCheckpointResult) {
				// our known throwable, provide with stack
				e.stack = stack;
			} else if (typeof(e)=="object" && typeof(e.stack)=="string") {
				// another throwable with pre-filled stack
				// append our crt stack as junction
				e.stack += "\n[coroutine junction] " + (new Error()).stack;
			}
			throw e;
		} else {
			return thisCrtn[$result];
		}
	}
	SYNCW.withCancel = function(cancellationCallback) {
		return SYNCW(cancellationCallback);
	}

	function getSyncr() {
		var triggered = false;
		return (curSyncr = function SYNC(error, result) {
			if (!triggered) {
				triggered = true;
				// ensure that resumption of coroutine occurs asynchronously
				// (so that no user logic occurs inside a possibly internal callback
				// invoked by a library from incomplete state)
				execAsync(function() {
					if (GLOBAL.CRTN==thisCrtn) {
						// not yet yielded from current crt
						// (should never happen, but just in case)
						thisCrtn[$resultAvailable] = true;
						thisCrtn[$error] = error;
						thisCrtn[$result] = result;
					} else {
						// otherwise, feed the error/result to the iterator
						var prevCrtn = GLOBAL.CRTN,
							prevSYNCW = GLOBAL.SYNCW,
							prevSYNC = GLOBAL.SYNC,
							prevSYNCTL = GLOBAL.SYNCTL;
						GLOBAL.CRTN = thisCrtn;
						GLOBAL.SYNCW = SYNCW;
						GLOBAL.SYNC = getSyncr();
						GLOBAL.SYNCTL = function SYNCTL(x) {
							return curSyncr(null, x);
						};
						thisCrtn[$timesliceStartedAt] = new Date().getTime();
						var done = false, crtResult, crtError;
						var theIterator = thisCrtn[$theIterator],
							theIteratorOnDone = theIterator[$onIteratorDone];
						try {
							if (first) {
								first = false;
							} else {
								thisCrtn[$resultAvailable] = true;
								thisCrtn[$error] = error;
								thisCrtn[$result] = result;
							}
							var val = theIterator.next();
							done = val.done;
							if (done) {
								crtResult = val.value;
								if (theIteratorOnDone) {
									theIteratorOnDone(null, crtResult);
								}
							}
						} catch(e) {
							// coroutine has thrown
							done = true; // obviously
							crtError = e;
							if (theIteratorOnDone) {
								theIteratorOnDone(crtError);
							}
						} finally {
							GLOBAL.CRTN = prevCrtn;
							GLOBAL.SYNCW = prevSYNCW;
							GLOBAL.SYNC = prevSYNC;
							GLOBAL.SYNCTL = prevSYNCTL;
							if (done) {
								thisCrtn[$completed] = true;
								thisCrtn[$error] = crtError;
								thisCrtn[$result] = crtResult;
								if (thisCrtn[$awaiters]) {
									// notify the awaiters
									for (var awaiter of thisCrtn[$awaiters]) {
										execAsync(awaiter, possiblyWrapCancellationResult(crtError),
											crtResult);
									}
									// and we no longer need to keep them
									thisCrtn[$awaiters] = null;
								}
							}
						}
					}
				});
			}
		});
	}

	thisCrtn[$theIterator] = isIterator ? gFunc : gFunc.apply(this, theArgs);
	execAsync(getSyncr(), null, null); // schedule the 1st step
	return maybePromisifyAwaitable(thisCrtn);
}

//
// start method in Object (for async method call)
//

Object.defineProperty(Object.prototype, startMethod,
{
	value: function(id, ...args) {
		return start.apply(this, [this[id], ...args]);
	},
	enumerable: false,
	configurable: true
});

// to prevent incorrect usage of start as of free function without including the
// rh-crt (which may result in calling as method of GLOBAL)
Object.defineProperty(GLOBAL, startMethod,
{
	value: undefined,
	enumerable: false,
	configurable: true
});

//
// Awaiter
//

const Awaiter = module.exports.Awaiter = function Awaiter() {
	if (this instanceof Awaiter) {
		throw new Error("Use Awaiter(), not new Awaiter()");
	}

	var awaiters = new Set(), done = false, e, r;
	function theAwaiter(err, result) {
		if (!done) {
			done = true;
			e = err;
			r = result;
			for (var awaiter of awaiters) {
				execAsync(awaiter, e, r);
			}
			awaiters = null; // no reason to keep them longer
		}
	}

	theAwaiter.__proto__ = {
		__proto__: Awaiter.__proto__,
		await: function await(callback) {
			if (!(callback instanceof Function)) {
				throw new TypeError("Callback must be a function");
			}
			if (done) {
				// already completed, invoke at once
				execAsync(callback, e, r);
			} else {
				// add to queue
				awaiters.add(callback);
			}
		},

		unawait: function unawait(callback) {
			awaiters && awaiters.delete(callback);
		},

		get done() {
			return done;
		},

		get error() {
			return e;
		},

		get result() {
			return r;
		}
	};
	return maybePromisifyAwaitable(theAwaiter);
}

//
// Awaiterification of promise
//

if (PROMISE_AVAILABLE) {

const $promiseAwaiter = Symbol();

function ensureBackingAwaiter(promise) {
	var result = promise[$promiseAwaiter];
	if (!result) {
		result = promise[$promiseAwaiter] = Awaiter();
		promise.then(function(r) {
				result(null, r);
			}, function(e) {
				result(e);
			});
	}
	return result;
}

Promise.prototype.await = function(callback) {
	return ensureBackingAwaiter(this).await(callback);
};

Promise.prototype.unawait = function(callback) {
	return ensureBackingAwaiter(this).unawait(callback);
};

// properties are configurable so they can be safely redefined
// on import of higher versions
Object.defineProperty(Promise.prototype, 'done',
{
	get: function() {
		return ensureBackingAwaiter(this).done;
	},
	enumerable: false,
	configurable: true
});

Object.defineProperty(Promise.prototype, 'result',
{
	get: function() {
		return ensureBackingAwaiter(this).result;
	},
	enumerable: false,
	configurable: true
});

Object.defineProperty(Promise.prototype, 'error',
{
	get: function() {
		return ensureBackingAwaiter(this).error;
	},
	enumerable: false,
	configurable: true
});


}

//
// Checkpoint
//

CheckpointResult = function CheckpointResult(errors, results) {
	this.__proto__ = GCheckpointResultInstance;
	this.errors = errors;
	this.results = results;
	this.toString = function toString() {
		return "CheckpointResult: errors = " + this.errors +
			", successes = " + this.results;
	};
};

function checkpointExtractArrayOfAwaitables(awaitables, keys, keysIsNumeric) {
	var arrayOfAwaitables = new Array(), firstArray = false;
	function addAwaitables(awaitable, useKeys) {
		if ((awaitable instanceof Array) || useKeys) {
			if (firstArray && keys) {
				// in keyed mode, no sub-arrays are allowed
				throw new TypeError("No sub-arrays of awaitables allowed in all/anyIn");
			} else {
				firstArray = true;
			}

			for (var subAwaiterKey in awaitable) {
				var subAwaiter = awaitable[subAwaiterKey];
				addAwaitables(subAwaiter);
				if (keys) {
					keys.push(keysIsNumeric ? +subAwaiterKey : subAwaiterKey);
				}
			}
		} else if (awaitable) {
			if (typeof(awaitable.next) == "function") {
				// iterator - push wrapped
				arrayOfAwaitables.push(start(awaitable));
			} else if (typeof(awaitable.await) == "function" &&
				typeof(awaitable.done) != "undefined") {
				// awaitable
				arrayOfAwaitables.push(awaitable);
			} else {
				// invalid awaitable
				throw new TypeError("Must provide awaitable or array of awaitables");
			}
		} else {
			// invalid awaitable
			throw new TypeError("Must provide awaitable or array of awaitables");
		}
	}

	addAwaitables(awaitables, keys);
	return arrayOfAwaitables;
}

function checkpointCreate(arrayOfAwaitables, waitUpTo, keys) {
	if (waitUpTo > arrayOfAwaitables.length) {
		throw new Error("Wait up to " + waitUpTo + " awaiters requested, only " + arrayOfAwaitables.length + " provided");
	}
	var completedSoFar = 0,
		errors, errorsCount = 0,
		results, resultsCount = 0,
		stopOn1stError = false, mustCancelAbandoned = false, cancelMsg,
		done = false;
	const finalAwaiter = Awaiter();

	if (keys) {
		// by-key mode - results will go under appropriate keys
		if (!keys.length || typeof(keys[0]) == "number") {
			errors = new Array();
			errors.length = keys.length;
			results = new Array();
			results.length = keys.length;
		} else {
			errors = {};
			results = {};
			for (var key in keys) {
				errors[keys[key]] = undefined;
				results[keys[key]] = undefined;
			}
		}
	} else {
		// not by-key mode - results will be appended as they ready
		errors = new Array();
		results = new Array();
	}

	var canceled = false, callback = null, unawaitAwaitables = null;
	if (waitUpTo <= 0) {
		// nothing to wait, trigger at once
		done = true;
		finalAwaiter(null, new CheckpointResult(errors, results));
	} else {
		var unawaited = false, callbacksByAwaitable = new Map();
		unawaitAwaitables = function unawaitAwaitables() {
			// cancel awaiting on awaitables that are no longer needed
			if (!unawaited && arrayOfAwaitables) {
				unawaited = true;
				for (var awaitable of arrayOfAwaitables) {
					var callback = callbacksByAwaitable.get(awaitable);
					try {
						if (callback && !awaitable.done) {
							typeof(awaitable.unawait) == "function" && awaitable.unawait(callback);
						}
					} catch (e) {
						// we can't help if unawait throws anything, but its
						// problems must not subvert the checkpoint convention
					}
				}
			}
		};

		function getCallback(key, useKey) {
			return function checkpointCallback(err, result) {
				if (!done) {
					if (typeof (key) == 'undefined') {
						if (err) { errors.push(err); errorsCount++; }
						else { results.push(result); resultsCount++; }
					} else {
						if (err) { errors[key] = err; errorsCount++; }
						else { results[key] = result; resultsCount++; }
					}
					if (++completedSoFar >= waitUpTo ||
						(err && stopOn1stError)) {
						done = true;
						var haveErrors = errorsCount > 0,
							finalResult = new CheckpointResult(errors, results);
						// depending on whether the total is success or an error,
						// return or throw
						finalAwaiter(haveErrors ? finalResult : null,
							haveErrors ? null : finalResult);
						unawaitAwaitables(); // no need to listen the rest
						if (mustCancelAbandoned && !canceled) {
							canceled = true; // considering this a cancel
							for (var awaitable of arrayOfAwaitables) {
								if (!awaitable.done) {
									typeof(awaitable.cancel) == "function" &&
									awaitable.cancel(cancelMsg);
								}
							}
						}
						if (completedSoFar >= arrayOfAwaitables.length) {
							// no longer use in the list, it can be disposed
							arrayOfAwaitables = null;
						}
					}
				}
			};
		}

		var callback = keys ? null : getCallback(undefined);
		for (var awaitableKey in arrayOfAwaitables) {
			var awaitable = arrayOfAwaitables[awaitableKey];
			if (keys) {
				callback = getCallback(keys[awaitableKey]);
			}
			awaitable.await(callback);
			callbacksByAwaitable.set(awaitable, callback);
		}
	}

	var me;
	return maybePromisifyAwaitable(me = {
		stopOnFirstError: function stopOnFirstError(yes) {
			stopOn1stError = yes;
			return me;
		},
		cancelAbandoned: function cancelAbandoned(yes, withMsg) {
			mustCancelAbandoned = yes;
			cancelMsg = withMsg;
			return me;
		},
		await: finalAwaiter.await.bind(finalAwaiter),
		unawait: finalAwaiter.unawait.bind(finalAwaiter),
		cancel: function cancel(msg) {
			if (!canceled) {
				canceled = true;
				if (arrayOfAwaitables) {
					for (var awaitable of arrayOfAwaitables) {
						if (!awaitable.done) {
							typeof(awaitable.cancel) == "function" && awaitable.cancel(msg);
						}
					}
				}
				if (done) {
					// no longer use in the list, it can be disposed
					arrayOfAwaitables = null;
				}
			}
		},
		get done() {
			return finalAwaiter.done;
		},
		get errors() {
			return finalAwaiter.done ? errors : undefined;
		},
		get results() {
			return finalAwaiter.done ? results : undefined;
		}
	});
}

const $objectProto = {}.__proto__;
const Checkpoint = module.exports.Checkpoint =
{
	allOf: function allOf(...awaitables) {
		var arrayOfAwaitables = checkpointExtractArrayOfAwaitables(awaitables);
		return checkpointCreate(arrayOfAwaitables, arrayOfAwaitables.length);
	},
	allIn: function allIn(awaitables) {
		if (!awaitables || !(awaitables instanceof Array ||
			awaitables.__proto__ == $objectProto) ||
			typeof (arguments[1]) != "undefined") {
			throw new TypeError("Checkpoint.allIn only accepts array or dictionary of awaitables");
		}
		var keys = new Array(), arrayOfAwaitables =
			checkpointExtractArrayOfAwaitables(awaitables, keys, awaitables instanceof Array);
		return checkpointCreate(arrayOfAwaitables, arrayOfAwaitables.length, keys);
	},
	anyOf: function anyOf(...awaitables) {
		var arrayOfAwaitables = checkpointExtractArrayOfAwaitables(awaitables);
		return awaitables.length ? checkpointCreate(arrayOfAwaitables, 1) :
			checkpointCreate(arrayOfAwaitables, 0);
	},
	anyIn: function anyIn(awaitables) {
		if (!awaitables || !(awaitables instanceof Array ||
			awaitables.__proto__ == $objectProto) ||
			typeof (arguments[1]) != "undefined") {
			throw new TypeError("Checkpoint.anyIn only accepts array or dictionary of awaitables");
		}
		var keys = new Array(), arrayOfAwaitables =
			checkpointExtractArrayOfAwaitables(awaitables, keys, awaitables instanceof Array);
		return keys.length ? checkpointCreate(arrayOfAwaitables, 1, keys) :
			checkpointCreate(arrayOfAwaitables, 0, keys);
	}
};

//
// NowThen
//

module.exports.NowThen = function NowThen() {
	if (this instanceof NowThen) {
		throw new Error("Use NowThen(), not new NowThen()");
	}

	var timesliceStartedAt = new Date().getTime();
	function updateTimesliceStartedAt() {
		timesliceStartedAt = new Date().getTime();
	}
	updateTimesliceStartedAt();

	function getTimesliceStartedAt() {
		// prefer crtk coroutine slice start mark if available
		return (typeof(CRTN) != 'undefined' && CRTN) ?
			+CRTN[$timesliceStartedAt] : timesliceStartedAt;
	}

	var stack = new Array(),
		stackTop = stack[0],
		me;
	function stackNewFrame() {
		stack.push({ syncs: new Array(), dtors: new Array() });
		stackTop = stack[stack.length - 1];
	}
	function stackPopFrame() {
		stack.pop();
		stackTop = stack[stack.length - 1];
	}
	function stackUnwindFrame() {
		var err = null;
		for (; stackTop.dtors.length;) {
			var dtor = stackTop.dtors.pop();
			try {
				dtor();
			} catch (e) {
				err = e;
			}
		}
		// the dtors stack is clear at this point

		stackTop.syncs.length = 0; // also clean up possibly stray syncs
		if (err) {
			throw err;
		}
	}
	stackNewFrame();

	return (me = {
		get SYNC() {
			var awaiter = Awaiter();
			awaiter[$doBeforeEnterPromise] = function() {
				updateTimesliceStartedAt();
				delete awaiter[$doBeforeEnterPromise]; // one-shot action
			};
			stackTop.syncs.push(awaiter);
			return awaiter;
		},
		get SYNCTL() {
			var awaiter = Awaiter();
			awaiter[$doBeforeEnterPromise] = function() {
				updateTimesliceStartedAt();
				delete awaiter[$doBeforeEnterPromise]; // one-shot action
			};
			stackTop.syncs.push(awaiter);
			return function(r) { awaiter(null, r); };
		},
		get SYNCW() {
			return stackTop.syncs.pop();
		},
		get TRY() {
			stackNewFrame();
		},
		get CATCH() {
			stackUnwindFrame();
		},
		get FINALLY() {
			stackUnwindFrame();
			stackPopFrame();
		},
		aft: function(dtor) {
			if (typeof(dtor) != "function") {
				throw new TypeError("aft-destructor must be a function");
			}
			stackTop.dtors.push(dtor);
		},
		timesliceUsedUp: function timesliceElapsed(ms) {
			return (new Date().getTime() - getTimesliceStartedAt()) >= ms;
		},
		get timesliceYield() {
			return start(function *timesliceYield() {
				execAsync(SYNC), yield *SYNCW();
			});
		}
	});
}
