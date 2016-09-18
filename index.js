//
// Generator based coroutine toolkit
//

const $cancelled = Symbol(),
	$cancelMsg = Symbol(),
	$completed = Symbol(),
	$result = Symbol(),
	$error = Symbol(),
	$resultAvailable = Symbol(),
	$theIterator = Symbol(),
	$awaiters = Symbol(),
	$eventListeners = Symbol(),
	Generator = Object.getPrototypeOf(function *(){}).constructor,
	// ^for instanceof check
	startMethod = module.exports.startMethod = Symbol();

const IS_BROWSER = typeof(window) != 'undefined';
const GLOBAL = IS_BROWSER ? window : global;

const execAsync = IS_BROWSER ?
function execAsync(callback, ...args) {
	setTimeout(callback.bind.apply(callback, [GLOBAL, ...args]), 0);
} :
function execAsync(callback, ...args) {
	process.nextTick(callback.bind.apply(callback, [GLOBAL, ...args]));
};

//
// Cancellation
//

const Cancellation = module.exports.Cancellation =
function Cancellation(msg) {
	this.message = msg;
	this.stack = new Error().stack;
	this.toString = function toString() {
		return "Cancellation: " + msg;
	};
}

//
// start and the core stuff
//

var CheckpointResult;
const start = module.exports.start =
function start(gFunc, ...theArgs) {
	// prechecks
	if (typeof(gFunc) != 'function') {
		throw new Error("Can only start with a function or a generator function");
	}
	if (!(gFunc instanceof Generator)) {
		// plain function wraps into generator
		var bindTo = this, func = gFunc;
		gFunc = function *() { return func.apply(bindTo, ...theArgs); };
	}

	var first = true,curSyncr, onceListeners = null;
	function getOnceListenersFor(channel) {
		return (onceListeners || (onceListeners = {}))
			[channel] || (onceListeners[channel] = new Set());
	}

	// Cancellation as result of a coroutine is wrapped into Error
	// with the same stack
	function possiblyWrapCancellationResult(e) {
		if (e instanceof Cancellation) {
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
				throw new Error("Callback must be a function");
			}
			if (curSyncr && callback == curSyncr) {
				throw new Error("Awaiting self not allowed");
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
		cancel: function cancel(cancelMsg) {
			if (!thisCrtn[$cancelled]) {
				thisCrtn[$cancelled] = true;
				thisCrtn[$cancelMsg] = cancelMsg;
				if (!thisCrtn[$completed]) {
					if (GLOBAL.CRTN!=thisCrtn) {
						// crt not completed and we're somewhere outside -
						// push signal to it
						execAsync(function()
						{ curSyncr && curSyncr(null,null); });
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
			cancellationCallback && cancellationCallback();
			throw new Cancellation(thisCrtn[$cancelMsg]);
		}
		thisCrtn[$resultAvailable] = false; // we are going to use it up
		if (thisCrtn[$error]!=null) {
			var e = thisCrtn[$error], stack = (new Error().stack);
			if (e instanceof CheckpointResult) {
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
						var done = false, crtResult, crtError;
						try {
							if (first) {
								first = false;
							} else {
								thisCrtn[$resultAvailable] = true;
								thisCrtn[$error] = error;
								thisCrtn[$result] = result;
							}
							var val = thisCrtn[$theIterator].next();
							done = val.done;
							if (done) {
								crtResult = val.value;
							}
						} catch(e) {
							// coroutine has thrown
							done = true; // obviously
							crtError = e;
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

	thisCrtn[$theIterator] = gFunc.apply(this, theArgs);
	execAsync(getSyncr(), null, null); // schedule the 1st step
	return thisCrtn;
}

//
// start method in Object (for async method call)
//

Object.defineProperty(Object.prototype, startMethod,
{
	value: function(id,...args) {
		return start.apply(this,[this[id],...args]);
	},
	enumerable: false
});

// to prevent incorrect usage of start as of free function without including the
// rh-crt (which may result in calling as method of GLOBAL)
Object.defineProperty(GLOBAL, startMethod,
{
	value: undefined,
	enumerable: false
});

//
// Awaiter
//

const Awaiter = module.exports.Awaiter = function Awaiter() {
	if (this instanceof Awaiter) {
		throw new Error("Use Awaiter(), not new Awaiter()");
	}

	var awaiters = new Set(),done = false, e, r;
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
		__proto__: Awaiter.prototype,
		await: function(callback) {
			if (!(callback instanceof Function)) {
				throw new Error("Callback must be a function");
			}
			if (done) {
				// already completed, invoke at once
				execAsync(callback, e, r);
			} else {
				// add to queue
				awaiters.add(callback);
			}
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
	return theAwaiter;
}

//
// Checkpoint
//

CheckpointResult = module.exports.checkpointResult =
function CheckpointResult(errors, results) {
	this.errors = errors;
	this.results = results;
};

CheckpointResult.prototype.toString = function toString() {
	return "CheckpointResult: errors = " + this.errors +
		", successes = " + this.results;
};

function checkpointExtractArrayOfAwaiters(awaiters) {
	var arrayOfAwaiters = [];
	function addAwaiters(awaiter) {
		if (awaiter instanceof Array) {
			for (var subAwaiter of awaiter) {
				addAwaiters(subAwaiter);
			}
		} else if (awaiter && typeof(awaiter.await) == "function" &&
			typeof(awaiter.done) != "undefined") {
			arrayOfAwaiters.push(awaiter);
		} else {
			// invalid awaiter
			throw new Error("Must provide awaitable or array of awaitables");
		}
	}
	addAwaiters(awaiters);
	return arrayOfAwaiters;
}

function checkpointCreate(arrayOfAwaiters, waitUpTo) {
	if (waitUpTo > arrayOfAwaiters.length) {
		throw new Error("Wait up to " + waitUpTo + " awaiters requested, only " + arrayOfAwaiters.length + " provided");
	}
	var completedSoFar = 0, errors = [], results = [],
		stopOn1stError = false, mustCancelOnFailure = false, cancelMsg,
		done = false;
	const finalAwaiter = Awaiter();
	finalAwaiter.__proto__ = {
		__proto__: finalAwaiter.__proto__,
		get errors() {
			return errors;
		},
		get successes() {
			return successes;
		}
	};

	if (waitUpTo <= 0) {
		// nothing to wait, trigger at once
		finalAwaiter(null, new CheckpointResult(errors, results));
	} else {
		for (var awaiter of arrayOfAwaiters) {
			awaiter.await(function(err, result) {
				if (!done) {
					if (err) { errors.push(err); }
					else { results.push(result); }
					if (++completedSoFar >= waitUpTo ||
						(err && stopOn1stError)) {
						done = true;
						var haveErrors = errors.length > 0,
							finalResult = new CheckpointResult(errors, results);
						// depending on whether the total is success or an error,
						// return or throw
						finalAwaiter(haveErrors ? finalResult : null,
							haveErrors ? null : finalResult);
						if (haveErrors && mustCancelOnFailure) {
							for (var awaiter of arrayOfAwaiters) {
								typeof(awaiter.cancel) == "function" &&
								awaiter.cancel(cancelMsg);
							}
						}
						arrayOfAwaiters = null; // give freedom to GC
					}
				}
			});
		}
	}
	var canceled = false;
	return ({
		stopOnFirstError: function stopOnFirstError(yes) {
			stopOn1stError = yes;
		},
		cancelOnFailure: function cancelOnFailure(yes, withMsg) {
			mustCancelOnFailure = yes;
			cancelMsg = withMsg;
		},
		await: finalAwaiter.await.bind(finalAwaiter),
		cancel: function cancel(msg) {
			if (!canceled) {
				canceled = true;
				if (arrayOfAwaiters) {
					for (var awaiter of arrayOfAwaiters) {
						typeof(awaiter.cancel) == "function" && awaiter.cancel(msg);
					}
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

const Checkpoint = module.exports.Checkpoint =
{
	allOf: function allOf(...awaiters) {
		var arrayOfAwaiters = checkpointExtractArrayOfAwaiters(awaiters);
		return checkpointCreate(arrayOfAwaiters, arrayOfAwaiters.length);
	},
	anyOf: function anyOf(...awaiters) {
		var arrayOfAwaiters = checkpointExtractArrayOfAwaiters(awaiters);
		return checkpointCreate(arrayOfAwaiters, 1);
	}
};
