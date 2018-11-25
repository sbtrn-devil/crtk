#!/usr/bin/env node
// use: node test.js

const {
	start,
	startMethod,
	Awaiter,
	Checkpoint,
	Cancellation,
	CheckpointResult,
	NowThen
} = require("./index.js");

var testCases = {
	// mark a test ID with '*' to ignore it
	"*CRTK-IGNORE":
	function *(log, assert) {
		// an example of disabled test
	},

	//
	// starting, resuming and delivering result
	//
	"CRTK-SRC-A-1":
	function *(log, assert) {
		log("Test: multiple coroutines can be started");
		var c1,c1r,c2,c2r,c3,c3r;
		c1 = start(function *() {
			c1r = true;
		});
		c2 = start(function *() {
			c2r = true;
		});
		c3 = start(function *() {
			c3r = true;
		});
		c1.await(SYNC), yield *SYNCW();
		c2.await(SYNC), yield *SYNCW();
		c3.await(SYNC), yield *SYNCW();
		assert(c1r && c2r && c3r, "All coroutines have run");
	},

	"CRTK-SRC-A-2":
	function *(log, assert) {
		log("Test: nested coroutines can be started");
		var c1, c1r, c2, c2r;
		c1 = start(function *() {
			c2 = start(function *() {
				c2r = true;
			});
			c1r = true;
		});
		c1.await(SYNC), yield *SYNCW();
		// after c1 completed, c2 should be already set by it
		c2.await(SYNC), yield *SYNCW();
	},

	"CRTK-SRC-A-3":
	function *(log, assert) {
		log("Test: coroutine can start with parameters");
		var c1 = start(function *(p1, p2, p3) {
			assert(p1 == 1, "P1 ok");
			assert(p2 == 2, "P2 ok");
			assert(p3 == 3, "P3 ok");
		}, 1, 2, 3);
		c1.await(SYNC), yield *SYNCW();
	},

	"CRTK-SRC-A-4":
	function *(log, assert) {
		log("Test: coroutine can start as methods with parameters");
		var object = {
			f: function *(p1, p2, p3) {
				assert(this == object, "Valid this object");
				assert(p1 == 1, "P1 ok");
				assert(p2 == 2, "P2 ok");
				assert(p3 == 3, "P3 ok");
			}
		};
		var c1 = object[startMethod] ("f", 1, 2, 3);
		c1.await(SYNC), yield *SYNCW();
	},

	"CRTK-SRC-A-5":
	function *(log, assert) {
		log("Test: coroutine can start from plain function");
		var r;
		start(function() { r = true; }).await(SYNC), yield *SYNCW();
		assert(r, "Plain function invoked");
	},

	"CRTK-SRC-A-5-1": // NJS 7+
	function *(log, assert) {
		log("Test: coroutine can start from async function");
		var r;
		start(async function() { r = true; }).await(SYNC), yield *SYNCW();
		assert(r, "Async function invoked");
	},

	"CRTK-SRC-A-6":
	function *(log, assert) {
		log("Test: coroutine can return value");
		var v = (start(function *() { return 10; }).await(SYNC), yield *SYNCW());
		assert(v == 10, "Expected value returned");
	},

	"CRTK-SRC-A-6-1":
	function *(log, assert) {
		log("Test: plain function coroutine can return value");
		var v = (start(function() { return 10; }).await(SYNC), yield *SYNCW());
		assert(v == 10, "Expected value returned");
	},

	"CRTK-SRC-A-6-2": // NJS 7+
	function *(log, assert) {
		log("Test: async function coroutine can return value");
		var v = (start(async function() { return 10; }).await(SYNC), yield *SYNCW());
		assert(v == 10, "Expected value returned");
	},

	"CRTK-SRC-A-7":
	function *(log, assert) {
		log("Test: coroutine can throw error");
		var err = {};
		try {
			start(function *() { throw err; }).await(SYNC), yield *SYNCW();
		} catch (e) {
			assert(e == err, "Expected value thrown");
			return;
		}
		assert(false, "Expected a throw");
	},

	"CRTK-SRC-A-7-1":
	function *(log, assert) {
		log("Test: plain function coroutine can throw error");
		var err = {};
		try {
		start(function () { throw err; }).await(SYNC), yield *SYNCW();
		} catch (e) {
			assert(e == err, "Expected value thrown");
			return;
		}
		assert(false, "Expected a throw");
	},

	"CRTK-SRC-A-7-2": // NJS 7+
	function *(log, assert) {
		log("Test: async function coroutine can throw error");
		var err = {};
		try {
		start(async function () { throw err; }).await(SYNC), yield *SYNCW();
		} catch (e) {
			assert(e == err, "Expected value thrown");
			return;
		}
		assert(false, "Expected a throw");
	},

	"CRTK-SRC-A-8":
	function *(log, assert) {
		log("Test: coroutine code starts asynchronously");
		var t = false, c = start(function *() {
				t = true;
			});
		assert(!t, "Coroutine not yet performed");
		c.await(SYNC), yield *SYNCW();
		assert(t, "Coroutine performed");
	},

	"CRTK-SRC-A-8-1":
	function *(log, assert) {
		log("Test: plain function coroutine code starts asynchronously");
		var t = false, c = start(function() {
				t = true;
			});
		assert(!t, "Coroutine not yet performed");
		c.await(SYNC), yield *SYNCW();
		assert(t, "Coroutine performed");
	},

	"CRTK-SRC-A-9":
	function *(log, assert) {
		log("Test: coroutine stores the result");
		var c = start(function *() {
			return 100;
		});
		c.await(SYNC), yield *SYNCW();
		assert(c.result == 100, "Expected result is stored");
	},

	"CRTK-SRC-A-10":
	function *(log, assert) {
		log("Test: coroutine stores the error");
		var c = start(function *() {
			throw "error";
		});
		try {
			c.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw");
		} catch (e) {
			assert(c.error == "error", "Expected error is stored");
		}
	},

	//
	// cancellation
	//
	"CRTK-SRC-B-1":
	function *(log, assert) {
		log("Test: coroutine can be canceled");
		var c = start(function *() {
			setTimeout(SYNC, 100), yield *SYNCW();
		});
		c.cancel();
		try {
			c.await(SYNC), yield *SYNCW();
		} catch(e) {
			assert(!(e instanceof Cancellation), "Awaiting on canceled coroutine throws Error instead of Cancellation");
			assert(c.error instanceof Cancellation, "Cancellation is stored in canceled coroutine's handle.error");
			return;
		}
		assert(false, "Awaiting canceled coroutine must throw");
	},

	"CRTK-SRC-B-2":
	function *(log, assert) {
		log("Test: coroutine can be canceled with a message");
		var c = start(function *() {
			try {
				setTimeout(SYNC, 100), yield *SYNCW();
			} catch(e) {
				assert((e instanceof Cancellation) && e.message == "test",
					"Cancellation with a valid message");
				throw e;
			}
		});
		c.cancel("test");
		try {
			c.await(SYNC), yield *SYNCW();
		} catch(e) {
			return;
		}
		assert(false, "Awaiting canceled coroutine must throw");
	},

	"CRTK-SRC-B-3":
	function *(log, assert) {
		log("Test: cancellation callback is triggered on cancellation");
		var got, c = start(function *() {
			try {
				setTimeout(SYNC, 100), yield *SYNCW.withCancel(function(msg) {
					got = msg;
				});
			} catch(e) {
				assert((e instanceof Cancellation) && e.message == "test",
					"Cancellation with a valid message");
				throw e;
			}
		});
		c.cancel("test");
		try {
			c.await(SYNC), yield *SYNCW();
		} catch(e) {
			return;
		}
		assert(got == "test", "Cancellation callback called and got the valid parameter");
	},

	"CRTK-SRC-B-4":
	function *(log, assert) {
		log("Test: coroutine that traps cancellation and returns normally is a normal finish");
		var c = start(function *() {
			try {
				setTimeout(SYNC, 100), yield *SYNCW();
			} catch(e) {
				return 200;
			}
		});
		c.cancel("test");
		var result = (c.await(SYNC), yield *SYNCW());
		assert(result == 200, "Coroutine returned normal value");
	},

	"CRTK-SRC-B-5":
	function *(log, assert) {
		log("Test: SYNCTL throws on cancellation");
		var c = start(function *() {
			setTimeout(SYNCTL, 100), yield *SYNCW();
		});
		c.cancel();
		try {
			c.await(SYNC), yield *SYNCW();
		} catch(e) {
			assert(!(e instanceof Cancellation), "Awaiting on canceled coroutine throws Error instead of Cancellation");
			assert(c.error instanceof Cancellation, "Cancellation is stored in canceled coroutine's handle.error");
			return;
		}
		assert(false, "Awaiting canceled coroutine must throw");
	},

	"CRTK-SRC-B-6":
	function *(log, assert) {
		log("Test: cancellation of self throws immediately");
		var c = start(function *() {
			c.cancel();
		});
		try {
			c.await(SYNC), yield *SYNCW();
		} catch(e) {
			assert(!(e instanceof Cancellation), "Awaiting on canceled coroutine throws Error instead of Cancellation");
			assert(c.error instanceof Cancellation, "Cancellation is stored in canceled coroutine's handle.error");
			return;
		}
		assert(false, "Awaiting canceled coroutine must throw");
	},

	"CRTK-SRC-B-7":
	function *(log, assert) {
		log("Test: Cancellation may not be constructed manually");
		var ok = false;
		try {
			new Cancellation("cancellation msg");
		} catch(e) {
			ok = true;
		}
		assert(ok, "Error is thrown on manual construction of Cancellation");
	},

	//
	// pseudo-global variables
	//
	"CRTK-SRC-C-1":
	function *(log, assert) {
		log("Test: magic pseudo-globals differ for different coroutines");
		var rSYNC1, rSYNC2, rSYNCTL1, rSYNCTL2, rSYNCW1, rSYNCW2, rCRTN1, rCRTN2;
		var c1 = start(function *() {
			rSYNC1 = SYNC;
			rSYNCTL1 = SYNCTL;
			rSYNCW1 = SYNCW;
			rCRTN1 = CRTN;
		}), c2 = start(function *() {
			rSYNC2 = SYNC;
			rSYNCTL2 = SYNCTL;
			rSYNCW2 = SYNCW;
			rCRTN2 = CRTN;
		});
		Checkpoint.allOf(c1, c2).await(SYNC), yield *SYNCW();
		assert(rSYNC1 != rSYNC2, "SYNCs differ");
		assert(rSYNCTL1 != rSYNCTL2, "SYNCTLs differ");
		assert(rSYNCW1 != rSYNCW2, "SYNCWs differ");
		assert(rCRTN1 != rCRTN2, "CRTNs differ");
	},

	"CRTK-SRC-C-2":
	function *(log, assert) {
		log("Test: magic pseudo-globals only defined inside coroutine");
		var typeofSYNC, typeofSYNCTL, typeofSYNCW, typeofCRTN;
		function extractor() {
			typeofSYNC = typeof(SYNC);
			typeofSYNCTL = typeof(SYNCTL);
			typeofSYNCW = typeof(SYNCW);
			typeofCRTN = typeof(CRTN);
		}
		setTimeout(extractor, 0);
		// ensure the plain timeout triggers
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(typeofSYNC == "undefined", "SYNC undefined");
		assert(typeofSYNCTL == "undefined", "SYNCTL undefined");
		assert(typeofSYNCW == "undefined", "SYNCW undefined");
		assert(typeofCRTN == "undefined", "CRTN undefined");

		// now try from coroutine (i. e. from ourselves)
		extractor();
		assert(typeofSYNC != "undefined", "SYNC defined");
		assert(typeofSYNCTL != "undefined", "SYNCTL defined");
		assert(typeofSYNCW != "undefined", "SYNCW defined");
		assert(typeofCRTN != "undefined", "CRTN defined");
	},

	"CRTK-SRC-C-3":
	function *(log, assert) {
		log("Test: CRTN is same down the coroutine stack");
		var sampleCRTN = CRTN;
		yield *(function *() {
			assert(CRTN == sampleCRTN, "CRTN same within a subgenerator");
		}());
		(function() {
			assert(CRTN == sampleCRTN, "CRTN same within a subfunction");
		})();
	},

	//
	// behaviour of SYNC
	//
	"CRTK-SRC-D-1":
	function *(log, assert) {
		log("Test: SYNC resumes coroutine asynchronously");
		var t1 = false, t2 = false, c = start(function *() {
				function asyncDo(callback) {
					setTimeout(function() {
						callback();
						t2 = !t1; // CRT will set t1=true on resumption,
						// ensure it hasn't happened at this point
					}, 0);
				}

				asyncDo(SYNC), yield *SYNCW();
				t1 = true;
			});
		c.await(SYNC), yield *SYNCW();
		assert(t2, "c did not resume inside the callback");
	},

	"CRTK-SRC-D-2":
	function *(log, assert) {
		log("Test: SYNC is one-shot");
		SYNC(null, 100);
		SYNC(null, 200);
		assert((yield *SYNCW()) == 100, "The yield *SYNCW() value is of first SYNC call");
		assert((SYNC(null, 300), yield *SYNCW()) == 300, "Second SYNC had no post-effects");
	},

	"CRTK-SRC-D-3":
	function *(log, assert) {
		log("Test: SYNC invoked from the coroutine triggers next SYNCW");
		SYNC(null, 100);
		var c = SYNC;
		var result = (setTimeout(function() { c(null, 200); }, 100), yield *SYNCW());
		assert(result == 100, "The yield *SYNCW() value is of first SYNC call");
	},

	"CRTK-SRC-D-4":
	function *(log, assert) {
		log("Test: SYNC is different instance after each SYNCW");
		var s1 = SYNC;
		SYNC(), yield *SYNCW();
		assert(SYNC != s1, "SYNC changed afte yield *SYNCW()");
	},

	//
	// Awaiter
	//
	"CRTK-SRC-E-1":
	function *(log, assert) {
		log("Test: Awaiter forwards the call to it");
		var aw = Awaiter();
		setTimeout(function () { aw(null, 100); }, 250);
		var result = (aw.await(SYNC), yield *SYNCW());
		assert(result == 100, "Valid result from awaiter");
	},

	"CRTK-SRC-E-2":
	function *(log, assert) {
		log("Test: Awaiter allows to await result after completed");
		var aw = Awaiter();
		aw(null, 100);
		assert(aw.done, "Awaiter finished");
		assert((aw.await(SYNC), yield *SYNCW()) == 100, "Got the result");
	},

	"CRTK-SRC-E-3":
	function *(log, assert) {
		log("Test: Awaiter is one-shot");
		var aw = Awaiter();
		aw(null, 100);
		aw(null, 200);
		assert((aw.await(SYNC), yield *SYNCW()) == 100, "Got the result from 1st call");
	},

	"CRTK-SRC-E-4":
	function *(log, assert) {
		log("Test: Awaiter invokes callback asynchronously");
		var aw1 = Awaiter(), t = false;
		aw1.await(function () { t = true; });
		aw1();
		assert(t == false, "Awaiter callback code does not run immediately");
		// give it a chance to trigger
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t == true, "Awaiter callback code triggered at all");
	},

	//
	// feedback events
	//
	"CRTK-SRC-F-1":
	function *(log, assert) {
		log("Test: event listeners are invoked with parameters");
		var c1 = 0,c2 = 0;
		CRTN.on("test", function(c) { c1 = c; });
		CRTN.on("test", function(c) { c2 = c; });
		CRTN.emit("test", 100);
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(c1 == 100 && c2 == 100, "Both callbacks were called with valid params");
	},

	"CRTK-SRC-F-2":
	function *(log, assert) {
		log("Test: event listener is invoked asynchronously");
		var c1 = 0;
		CRTN.on("test", function() { c1 = 100; });
		CRTN.emit("test");
		assert(c1 == 0, "Listener did not trigger immediately");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(c1 == 100, "Listener triggered after all");
	},

	"CRTK-SRC-F-3":
	function *(log, assert) {
		log("Test: unsubscribed event listener is not invoked");
		var c1 = 0;
		CRTN.emit("test"); // first emit then subscribe
		CRTN.on("test", function() { c1 = 100; });
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(c1 == 0, "Listener did not trigger");
	},

	"CRTK-SRC-F-4":
	function *(log, assert) {
		log("Test: event listener from other channel is not called");
		var t1 = false, t2 = false;
		CRTN.on("test", function() { t1 = true; });
		CRTN.on("test1", function() { t2 = true; });
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1, "Listener on 'test' triggered");
		assert(!t2, "Listener on 'test1' did not trigger");
	},

	"CRTK-SRC-F-5":
	function *(log, assert) {
		log("Test: removed event is not called");
		var t1 = false, t2 = false, c;
		CRTN.on("test", function() { t1 = true; });
		CRTN.on("test", c = function() { t2 = true; });
		CRTN.removeListener("test", c);
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1, "Listener triggered");
		assert(!t2, "Removed listener did not trigger");
	},

	"CRTK-SRC-F-6":
	function *(log, assert) {
		log("Test: same listener is not added and called twice");
		var t1 = 0, c;
		CRTN.on("test", c = function() { t1++; });
		CRTN.on("test", c);
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1 == 1, "Listener triggered once");
	},

	"CRTK-SRC-F-7":
	function *(log, assert) {
		log("Test: once-listener only triggers once");
		var t1 = 0, t2 = 0;
		CRTN.on("test", function() { t1++; });
		CRTN.once("test", function() { t2++; });
		CRTN.emit("test");
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1 == 2, "Plain listener triggered twice");
		assert(t2 == 1, "Once-listener triggered once");
	},

	"CRTK-SRC-F-8":
	function *(log, assert) {
		log("Test: removeAllListeners removes all listeners");
		var t1 = 0, t2 = 0;
		CRTN.on("test", function() { t1++; });
		CRTN.once("test", function() { t2++; });
		CRTN.removeAllListeners("test");
		CRTN.emit("test");
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1 == 0, "Plain listener did not trigger");
		assert(t2 == 0, "Once-listener did not trigger");
	},

	"CRTK-SRC-F-9":
	function *(log, assert) {
		log("Test: removeAllListeners does not affect other channels");
		var t1 = 0, t2 = 0;
		CRTN.on("test", function() { t1++; });
		CRTN.once("test", function() { t2++; });
		CRTN.removeAllListeners("test1");
		CRTN.emit("test");
		CRTN.emit("test");
		// give them chance to work
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t1 == 2, "Plain listener triggered twice");
		assert(t2 == 1, "Once-listener triggered once");
	},

	//
	// checkpoint
	//
	"CRTK-SRC-G-1":
	function *(log, assert) {
		log("Test: allOf waits for all awaitables");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
			});
		Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished");
		assert(f2, "Coroutine 2 finished");
		assert(f3, "Coroutine 3 finished");
	},

	"CRTK-SRC-G-2":
	function *(log, assert) {
		log("Test: anyOf waits for soonest awaitable");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
			});
		Checkpoint.anyOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished on anyOf");
		assert(!f2, "Coroutine 2 not finished on anyOf");
		assert(!f3, "Coroutine 3 not finished on anyOf");

		Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished at all");
		assert(f2, "Coroutine 2 finished at all");
		assert(f3, "Coroutine 3 finished at all");
	},

	"CRTK-SRC-G-3":
	function *(log, assert) {
		log("Test: allOf waits for all even if error");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw new Error("test error");
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
			});
		var thrown = false;
		try {
			Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		} catch(e) {
			thrown = true;
			assert(e instanceof CheckpointResult &&
				e.errors.length == 1 &&
				e.errors[0].message == "test error",
				"Catched the expected error");
		}
		assert(f1, "Coroutine 1 finished");
		assert(f2, "Coroutine 2 finished");
		assert(f3, "Coroutine 3 finished");
		assert(thrown, "Expected error was thrown");
	},

	"CRTK-SRC-G-4":
	function *(log, assert) {
		log("Test: allOf doesn't wait for remaining if stopOnFirstError");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw new Error("test error");
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
			});
		var thrown = false;
		try {
			Checkpoint.allOf(ch1, ch2, ch3).stopOnFirstError(true)
			.await(SYNC), yield *SYNCW();
		} catch(e) {
			thrown = true;
		}
		assert(f1, "Coroutine 1 finished");
		assert(!f2, "Coroutine 2 not finished");
		assert(!f3, "Coroutine 3 not finished");
		assert(thrown, "Error was thrown");

		try {
			thrown = false;
			Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		} catch(e) {
			thrown = true;
		}
		assert(f1, "Coroutine 1 finished at all");
		assert(f2, "Coroutine 2 finished at all");
		assert(f3, "Coroutine 3 finished at all");
		assert(thrown, "Error was persistently thrown on second await");
	},

	"CRTK-SRC-G-5":
	function *(log, assert) {
		log("Test: anyOf cancels remaining if cancelAbandoned");
		var f1 = false, f2 = false, f3 = false,
			c1 = false, c2 = false, c3 = false;
		var ch1 = start(function *() {
				try {
					setTimeout(SYNC, 100); yield *SYNCW();
					f1 = true;
				} catch (e) {
					c1 = true;
				}
			}),
			ch2 = start(function *() {
				try {
					setTimeout(SYNC, 250); yield *SYNCW();
					f2 = true;
				} catch (e) {
					c2 = true;
				}
			}),
			ch3 = start(function *() {
				try {
					setTimeout(SYNC, 500); yield *SYNCW();
					f3 = true;
				} catch (e) {
					c3 = true;
				}
			});
		Checkpoint.anyOf(ch1, ch2, ch3).cancelAbandoned(true)
		.await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished on anyOf");
		assert(!f2, "Coroutine 2 not finished on anyOf");
		assert(!f3, "Coroutine 3 not finished on anyOf");

		Checkpoint.allOf(ch1, ch2, ch3).await(SYNCTL), yield *SYNCW();
		assert(f1 && !c1, "Coroutine 1 finished at all, not canceled");
		assert(!f2 && c2, "Coroutine 2 canceled in the end");
		assert(!f3 && c3, "Coroutine 3 canceled in the end");
	},

	"CRTK-SRC-G-6":
	function *(log, assert) {
		log("Test: allOf cancels remaining if stopOnFirstError and cancelAbandoned");
		var f1 = false, f2 = false, f3 = false,
			c1 = false, c2 = false, c3 = false;
		var ch1 = start(function *() {
				try {
					setTimeout(SYNC, 100); yield *SYNCW();
					f1 = true;
				} catch (e) {
					c1 = true;
				}
				throw new Error("test error");
			}),
			ch2 = start(function *() {
				try {
					setTimeout(SYNC, 250); yield *SYNCW();
					f2 = true;
				} catch (e) {
					c2 = true;
				}
			}),
			ch3 = start(function *() {
				try {
					setTimeout(SYNC, 500); yield *SYNCW();
					f3 = true;
				} catch (e) {
					c3 = true;
				}
			});
		Checkpoint.allOf(ch1, ch2, ch3)
		.stopOnFirstError(true)
		.cancelAbandoned(true)
		.await(SYNCTL), yield *SYNCW();
		assert(f1, "Coroutine 1 finished on allOf");
		assert(!f2, "Coroutine 2 not finished on allOf");
		assert(!f3, "Coroutine 3 not finished on allOf");

		Checkpoint.allOf(ch1, ch2, ch3).await(SYNCTL), yield *SYNCW();
		assert(f1 && !c1, "Coroutine 1 finished at all, not canceled");
		assert(!f2 && c2, "Coroutine 2 canceled in the end");
		assert(!f3 && c3, "Coroutine 3 canceled in the end");
	},

	"CRTK-SRC-G-7":
	function *(log, assert) {
		log("Test: Checkpoint has .done property");
		var aw = Awaiter(), cp = Checkpoint.allOf(aw);
		assert(!cp.done, "Checkpoint .done not set before done");
		aw();
		cp.await(SYNC), yield *SYNCW();
		assert(cp.done, "Checkpoint .done set after done");
	},

	"CRTK-SRC-G-8":
	function *(log, assert) {
		log("Test: Checkpoint has .results property");
		var cp = Checkpoint.allOf();
		assert(cp.results instanceof Array, "Checkpoint has .results array property");
	},

	"CRTK-SRC-G-9":
	function *(log, assert) {
		log("Test: Checkpoint has .errors property");
		var cp = Checkpoint.allOf();
		assert(cp.errors instanceof Array, "Checkpoint has .errors array property");
	},

	"CRTK-SRC-G-10":
	function *(log, assert) {
		log("Test: Null checkpoint is a valid awaitable");
		var cp = Checkpoint.allOf(), t = false;
		cp.await(function() { t = true; });
		setTimeout(SYNC, 100); yield *SYNCW(); // give it chance to work
		assert(t, "Null checkpoint awaited successfully");
	},

	"CRTK-SRC-G-11":
	function *(log, assert) {
		log("Test: Checkpoint.cancel must propagate");
		var t1 = false, c1 = start(function *() {
			setTimeout(SYNC, 100), yield *SYNCW(function(cm) { t1 = cm; });
		});
		var t2 = false, c2 = start(function *() {
			setTimeout(SYNC, 100), yield *SYNCW(function(cm) { t2 = cm; });
		});
		var t3 = false, c3 = start(function *() {
			setTimeout(SYNC, 100), yield *SYNCW(function(cm) { t3 = cm; });
		});
		var cp = Checkpoint.allOf(c1, c2, c3);
		cp.cancel("Y"); // this message must not be used
		try {
			cp.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw (checkpoint)");
		} catch (e) {
		}
		try {
			c1.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw (coroutine 1)");
		} catch (e) {
		}
		try {
			c2.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw (coroutine 2)");
		} catch (e) {
		}
		try {
			c3.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw (coroutine 3)");
		} catch (e) {
		}
		setTimeout(SYNC, 150); yield *SYNCW();
		assert(t1 == "Y" && t2 == "Y" && t3 == "Y",
			"Checkpoint cancellation has propagated correctly");
	},

	"CRTK-SRC-G-12":
	function *(log, assert) {
		log("Test: Checkpoint.cancel is valid after checkpoint is done");
		var aw = Awaiter(), cp = Checkpoint.allOf(aw);
		aw();
		cp.await(SYNC), yield *SYNCW();
		cp.cancel(); // must not fail
	},

	"CRTK-SRC-G-13":
	function *(log, assert) {
		log("Test: CheckpointResult implements toString");
		var cp = Checkpoint.allOf();
		var result = (cp.await(SYNC), yield *SYNCW());
		assert(result.toString().match(/CheckpointResult/),
			"CheckpointResult toString worked");
	},

	"CRTK-SRC-G-14": // NJS 7+
	function *(log, assert) {
		log("Test: Checkpoint accepts iterators and promises");
		var cp = Checkpoint.allOf(
			function *(x) { return x + 1; }(100),
			async function(x) { return x + 3; }(200));
		var result = (cp.await(SYNC), yield *SYNCW());
		assert(result.results[0] == 101 || result.results[1] == 101,
			"Iterator based checkpoint entry returned the expected result");
		assert(result.results[0] == 203 || result.results[1] == 203,
			"Promise based checkpoint entry returned the expected result");
	},

	"CRTK-SRC-G-15": // NJS 7+
	function *(log, assert) {
		log("Test: Checkpoint accepts iterators and promises, and they may throw");
		var cp = Checkpoint.allOf(
			function *(x) { throw x + 1; }(100),
			async function(x) { throw x + 3; }(200));
		var result = [];
		try {
			cp.await(SYNC), yield *SYNCW();
		} catch (e) {
			result = e;
		}
		assert(result.errors[0] == 101 || result.errors[1] == 101,
			"Iterator based checkpoint entry threw the expected result");
		assert(result.errors[0] == 203 || result.errors[1] == 203,
			"Promise based checkpoint entry threw the expected result");
	},

	"CRTK-SRC-G-16": // NJS 7+
	function *(log, assert) {
		log("Test: Checkpoint rejects invalid entries");
		var thrown = 0,
			badOfferings = [
				0,
				null,
				1,
				"string",
				"",
				{}
			];
		for (var offering of badOfferings) {
			try {
				Checkpoint.allOf(offering);
			} catch (e) {
				thrown++;
			}
		}

		assert(thrown == badOfferings.length,
			"Checkpoint rejected all the invalid entries");
	},

	"CRTK-SRC-G-17":
	function *(log, assert) {
		log("Test: CheckpointResult may not be constructed manually");
		var ok = false;
		try {
			new CheckpointResult([], []);
		} catch(e) {
			ok = true;
		}
		assert(ok, "Error is thrown on manual construction of CheckpointResult");
	},

	"CRTK-SRC-G-18":
	function *(log, assert) {
		log("Test: allIn waits for all awaitables in array and puts results by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				return "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				return "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				return "C3";
			});
		var cp = (Checkpoint.allIn([ch2, ch1, ch3]).await(SYNC), yield *SYNCW());
		assert(f1, "Coroutine 1 finished");
		assert(f2, "Coroutine 2 finished");
		assert(f3, "Coroutine 3 finished");
		assert(cp.results[0] == "C2", "Coroutine 2 result got into valid slot");
		assert(cp.results[1] == "C1", "Coroutine 1 result got into valid slot");
		assert(cp.results[2] == "C3", "Coroutine 3 result got into valid slot");
	},

	"CRTK-SRC-G-19":
	function *(log, assert) {
		log("Test: allIn waits for all awaitables in dictionary and puts results by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				return "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				return "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				return "C3";
			});
		var cp = (Checkpoint.allIn({ a: ch2, b: ch1, c: ch3 }).await(SYNC), yield *SYNCW());
		assert(f1, "Coroutine 1 finished");
		assert(f2, "Coroutine 2 finished");
		assert(f3, "Coroutine 3 finished");
		assert(cp.results.a == "C2", "Coroutine 2 result got into valid slot");
		assert(cp.results.b == "C1", "Coroutine 1 result got into valid slot");
		assert(cp.results.c == "C3", "Coroutine 3 result got into valid slot");
	},

	"CRTK-SRC-G-20":
	function *(log, assert) {
		log("Test: anyIn waits for soonest awaitable in array and puts results by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				return "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				return "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				return "C3";
			});
		var cp = (Checkpoint.anyIn([ch2, ch1, ch3]).await(SYNC), yield *SYNCW());
		assert(f1, "Coroutine 1 finished on anyOf");
		assert(!f2, "Coroutine 2 not finished on anyOf");
		assert(!f3, "Coroutine 3 not finished on anyOf");

		Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished at all");
		assert(f2, "Coroutine 2 finished at all");
		assert(f3, "Coroutine 3 finished at all");

		assert(typeof (cp.results[0]) == "undefined", "Coroutine 2 result correctly dismissed");
		assert(cp.results[1] == "C1", "Coroutine 1 result got into valid slot");
		assert(typeof (cp.results[2]) == "undefined", "Coroutine 3 result correctly dismissed");
	},

	"CRTK-SRC-G-21":
	function *(log, assert) {
		log("Test: anyIn waits for soonest awaitable in dictionary and puts results by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				return "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				return "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				return "C3";
			});
		var cp = (Checkpoint.anyIn({ a: ch2, b: ch1, c: ch3 }).await(SYNC), yield *SYNCW());
		assert(f1, "Coroutine 1 finished on anyOf");
		assert(!f2, "Coroutine 2 not finished on anyOf");
		assert(!f3, "Coroutine 3 not finished on anyOf");

		Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		assert(f1, "Coroutine 1 finished at all");
		assert(f2, "Coroutine 2 finished at all");
		assert(f3, "Coroutine 3 finished at all");

		assert(typeof (cp.results.a) == "undefined", "Coroutine 2 result correctly dismissed");
		assert(cp.results.b == "C1", "Coroutine 1 result got into valid slot");
		assert(typeof (cp.results.c) == "undefined", "Coroutine 3 result correctly dismissed");
	},

	///
	"CRTK-SRC-G-22":
	function *(log, assert) {
		log("Test: allIn waits for all awaitables in array and puts errors by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				throw "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				throw "C3";
			});
		try {
			Checkpoint.allIn([ch2, ch1, ch3]).await(SYNC), yield *SYNCW();
			assert(false, "Throw expected");
		} catch (cp) {
			if (cp.isAssertionFailure) throw cp; // assersion, rethrow
			assert(f1, "Coroutine 1 finished");
			assert(f2, "Coroutine 2 finished");
			assert(f3, "Coroutine 3 finished");
			assert(cp.errors[0] == "C2", "Coroutine 2 error got into valid slot");
			assert(cp.errors[1] == "C1", "Coroutine 1 error got into valid slot");
			assert(cp.errors[2] == "C3", "Coroutine 3 error got into valid slot");
		}
	},

	"CRTK-SRC-G-23":
	function *(log, assert) {
		log("Test: allIn waits for all awaitables in dictionary and puts errors by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				throw "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				throw "C3";
			});
		try {
			Checkpoint.allIn({ a: ch2, b: ch1, c: ch3 }).await(SYNC), yield *SYNCW();
			assert(false, "Throw expected");
		} catch (cp) {
			if (cp.isAssertionFailure) throw cp; // assersion, rethrow
			assert(f1, "Coroutine 1 finished");
			assert(f2, "Coroutine 2 finished");
			assert(f3, "Coroutine 3 finished");
			assert(cp.errors.a == "C2", "Coroutine 2 error got into valid slot");
			assert(cp.errors.b == "C1", "Coroutine 1 error got into valid slot");
			assert(cp.errors.c == "C3", "Coroutine 3 error got into valid slot");
		}
	},

	"CRTK-SRC-G-24":
	function *(log, assert) {
		log("Test: anyIn waits for soonest awaitable in array and puts errors by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				throw "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				throw "C3";
			});
		var cp;
		try {
			Checkpoint.anyIn([ch2, ch1, ch3]).await(SYNC), yield *SYNCW();
			assert(false, "Throw expected");
		} catch (e) {
			if (e.isAssertionFailure) throw e; // assersion, rethrow
			cp = e;
		}
		assert(f1, "Coroutine 1 finished on anyOf");
		assert(!f2, "Coroutine 2 not finished on anyOf");
		assert(!f3, "Coroutine 3 not finished on anyOf");

		try {
			Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		    assert(false, "Throw expected");
		} catch (e) {
			if (e.isAssertionFailure) throw e; // assersion, rethrow
			assert(f1, "Coroutine 1 finished at all");
			assert(f2, "Coroutine 2 finished at all");
			assert(f3, "Coroutine 3 finished at all");
		}

		assert(typeof (cp.errors[0]) == "undefined", "Coroutine 2 error correctly dismissed");
		assert(cp.errors[1] == "C1", "Coroutine 1 error got into valid slot");
		assert(typeof (cp.errors[2]) == "undefined", "Coroutine 3 error correctly dismissed");
	},

	"CRTK-SRC-G-25":
	function *(log, assert) {
		log("Test: anyIn waits for soonest awaitable in dictionary and puts errors by key");
		var f1 = false, f2 = false, f3 = false;
		var ch1 = start(function *() {
				setTimeout(SYNC, 100); yield *SYNCW();
				f1 = true;
				throw "C1";
			}),
			ch2 = start(function *() {
				setTimeout(SYNC, 250); yield *SYNCW();
				f2 = true;
				throw "C2";
			}),
			ch3 = start(function *() {
				setTimeout(SYNC, 500); yield *SYNCW();
				f3 = true;
				throw "C3";
			});
		var cp;
		try {
			Checkpoint.anyIn({ a: ch2, b: ch1, c: ch3 }).await(SYNC), yield *SYNCW();
			assert(false, "Throw expected");
		} catch (e) {
			if (e.isAssertionFailure) throw e; // assersion, rethrow
			assert(f1, "Coroutine 1 finished on anyOf");
			assert(!f2, "Coroutine 2 not finished on anyOf");
			assert(!f3, "Coroutine 3 not finished on anyOf");
			cp = e;
		}

		try {
			Checkpoint.allOf(ch1, ch2, ch3).await(SYNC), yield *SYNCW();
		    assert(false, "Throw expected");
		} catch (e) {
			if (e.isAssertionFailure) throw e; // assersion, rethrow
			assert(f1, "Coroutine 1 finished at all");
			assert(f2, "Coroutine 2 finished at all");
			assert(f3, "Coroutine 3 finished at all");
		}

		assert(typeof (cp.errors.a) == "undefined", "Coroutine 2 result correctly dismissed");
		assert(cp.errors.b == "C1", "Coroutine 1 result got into valid slot");
		assert(typeof (cp.errors.c) == "undefined", "Coroutine 3 result correctly dismissed");
	},

	//
	// Promise interaction
	//

	"CRTK-SRC-H-1":
	function *(log, assert) {
		log("Test: Awaiter is a Promise");
		var aw1 = Awaiter(), t = false;
		aw1.then(function () { t = true; }, function() {});
		aw1();
		assert(t == false, "Awaiter callback code does not run immediately");
		// give it a chance to trigger
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t == true, "Awaiter resolved as a promise");
	},

	"CRTK-SRC-H-1-1":
	function *(log, assert) {
		log("Test: Awaiter is a Promise and can throw");
		var aw1 = Awaiter(), t = false;
		aw1.catch(function () { t = true; });
		aw1("error");
		assert(t == false, "Awaiter callback code does not run immediately");
		// give it a chance to trigger
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t == true, "Awaiter rejected as a promise");
	},

	"CRTK-SRC-H-1-2":
	function *(log, assert) {
		log("Test: Awaiter is a valid Promise");
		var aw1 = Awaiter(), t = false;
		// if it is consumed by Promise.all we can believe it's ok
		Promise.all([aw1]).then(function () { t = true; }, function() {});
		aw1();
		assert(t == false, "Awaiter callback code does not run immediately");
		// give it a chance to trigger
		setTimeout(SYNC, 100), yield *SYNCW();
		assert(t == true, "Awaiter resolved as a promise");
	},

	"CRTK-SRC-H-2":
	function *(log, assert) {
		log("Test: Promise is full Awaitable");
		var promise = new Promise(function(acc, rej) {
			setTimeout(function () { acc(150); }, 100);
		});
		// Checkpoint.allOf checks for sufficient Awaitable-ness
		var r = (Checkpoint.allOf(promise).await(SYNC), yield *SYNCW());
		assert(r.results[0] == 150, "Promise returned result as awaitable");

		promise.unawait(function() {}); // full = has unawait too
	},

	"CRTK-SRC-H-2-1":
	function *(log, assert) {
		log("Test: Promise is Awaitable and can reject");
		var promise = new Promise(function(acc, rej) {
			setTimeout(function () { rej(150); }, 100);
		});
		// Checkpoint.allOf checks for sufficient Awaitable-ness
		var cp = Checkpoint.allOf(promise);
		try {
			Checkpoint.allOf(promise).await(SYNC), yield *SYNCW();
		} catch (e) {
		}
		assert(cp.errors[0] == 150, "Promise rejected result as awaitable");
	},

	"CRTK-SRC-H-3":
	function *(log, assert) {
		log("Test: Promise has .done property");
		var promise = new Promise(function(acc, rej) {
			setTimeout(function () { acc(150); }, 100);
		});
		assert(!promise.done, "Promise .done not set before done");
		promise.await(SYNC), yield *SYNCW();
		assert(promise.done, "Promise .done set after done");
	},

	"CRTK-SRC-H-4":
	function *(log, assert) {
		log("Test: Promise has .result property");
		var promise = new Promise(function(acc, rej) {
			setTimeout(function () { acc(150); }, 100);
		});
		promise.await(SYNC), yield *SYNCW();
		assert(promise.result == 150, "Promise stored the result");
	},

	"CRTK-SRC-H-5":
	function *(log, assert) {
		log("Test: Promise has .error property");
		var promise = new Promise(function(acc, rej) {
			setTimeout(function () { rej(150); }, 100);
		});
		try {
			promise.await(SYNC), yield *SYNCW();
		} catch (e) {
		}
		assert(promise.error == 150, "Promise stored the error");
	},

	//
	// NowThen (all tests are NJS 7+)
	//
	"CRTK-SRC-I-1":
	function *(log, assert) {
		log("Test: await ((...NowThen.SYNC...), NowThen.SYNCW) is able to resume a coroutine");
		var t = false, c = start(async function () {
				var nt = NowThen();
				await (setTimeout(nt.SYNC, 1), nt.SYNCW);
				t = true;
				return 150;
			});
		setTimeout(SYNC, 100), yield *SYNCW(); // give it a chance
		c.await(SYNC), yield *SYNCW();
		assert(t, "The coroutine successfully progressed via nt.SYNC/SYNCW");
		assert(c.result == 150, "Valid value was passed to nt.SYNC");
	},

	"CRTK-SRC-I-2":
	function *(log, assert) {
		log("Test: NowThen.SYNC/SYNCW generated properly in complex expressions");
		function f1(callback, x) {
			start(async function() { callback (null, x); });
		}
		function f2(callback, x, y) {
			start(async function() { callback (null, x + y); });
		}
		var t;
		start (async function () {
			var nt = NowThen();
			t = await (
				f2(nt.SYNC, await(
						f1(nt.SYNC, "1"), nt.SYNCW
					), await(
						f1(nt.SYNC, "2"), nt.SYNCW
					)),
				nt.SYNCW);
			assert(t == "12", "The calls are properly performed");
		}).await(SYNC), yield *SYNCW();
		assert(t, "The coroutine successfully progressed via nt.SYNC/SYNCW");
	},

	"CRTK-SRC-I-3":
	function *(log, assert) {
		log("Test: await ((...NowThen.SYNCTL...), NowThen.SYNCW) is able to resume a coroutine");
		var t = false, c = start(async function () {
				var nt = NowThen();
				var result = await (function(callback) {
					setTimeout(function() {
						callback(100);
					}, 1);
				} (nt.SYNCTL), nt.SYNCW);
				t = true;
				return result;
			});
		setTimeout(SYNC, 100), yield *SYNCW(); // give it a chance
		c.await(SYNC), yield *SYNCW();
		assert(t, "The coroutine successfully progressed via nt.SYNCTL/SYNCW");
		assert(c.result == 100, "Valid value was passed to nt.SYNCTL");
	},

	"CRTK-SRC-I-4":
	function *(log, assert) {
		log("Test: NowThen timeslice feature works in generator coroutine");
		var failed = false, c = start(function *() {
			var nt = NowThen(),
				startAt = new Date().getTime(),
				lastYieldAt = startAt;
			for (; new Date().getTime() - startAt < 500;) {
				if (nt.timesliceUsedUp(10)) {
					nt.timesliceYield.await(SYNC), yield *SYNCW();
					lastYieldAt = new Date().getTime();
				}

				// OS scheduler break-in can add up to OS timeslice lag,
				// so making a reservation up to 100 ms
				if (new Date().getTime() - lastYieldAt > 110) {
					// timeslice detection wasn't properly detected,
					// or didn't properly yield in time
					failed = true;
					return;
				}
			}
		});

		c.await(SYNC), yield *SYNCW();
		assert(!failed, "Timeslice detected and yielded properly");
	},

	"CRTK-SRC-I-5":
	function *(log, assert) {
		log("Test: NowThen timeslice feature works in async func coroutine");
		var failed = false, c = start(async function () {
			var nt = NowThen(),
				startAt = new Date().getTime(),
				lastYieldAt = startAt;
			for (; new Date().getTime() - startAt < 500;) {
				if (nt.timesliceUsedUp(10)) {
					await(nt.timesliceYield);
					lastYieldAt = new Date().getTime();
				}

				// OS scheduler break-in can add up to OS timeslice lag,
				// so making a reservation up to 100 ms
				if (new Date().getTime() - lastYieldAt > 110) {
					// timeslice detection wasn't properly detected,
					// or didn't properly yield in time
					failed = true;
					return;
				}
			}
		});

		c.await(SYNC), yield *SYNCW();
		assert(!failed, "Timeslice detected and yielded properly");
	},

	"CRTK-SRC-I-6":
	function *(log, assert) {
		log("Test: NowThen TRY/aft/CATCH/FINALLY basic functionality");

		var nt = NowThen(), ag = new Array();
		nt.aft(() => ag.push("1"));

		try {
			nt.TRY;
			nt.aft(() => ag.push("2"));
			nt.aft(() => ag.push("3"));

			ag.push("4");

			for (var i = 0; i < 3; i++) {
				try {
					nt.TRY;
					nt.aft(() => ag.push("5"));
					ag.push("6");
					if (i == 1) throw "e";
				} finally {
					nt.FINALLY;
				}
			}
		} catch (e) {
			nt.CATCH;
			nt.aft(() => ag.push("7"));

			ag.push("8");
		} finally {
			nt.FINALLY;
		}

		ag.push("9");
		nt.FINALLY;

		assert(ag[0] == "4" &&
			ag[1] == "6" &&
			ag[2] == "5" &&
			ag[3] == "6" &&
			ag[4] == "5" &&
			ag[5] == "3" &&
			ag[6] == "2" &&
			ag[7] == "8" &&
			ag[8] == "7" &&
			ag[9] == "9" &&
			ag[10] == "1",
			"Valid agenda order");
	},

	"CRTK-SRC-I-7":
	function *(log, assert) {
		log("Test: NowThen TRY/aft/CATCH/FINALLY - leaking exception from dtor");

		var nt = NowThen(), ok = false;

		try {
			nt.TRY;
			try {
				nt.aft(() => { throw "e"; });
			} finally {
				nt.FINALLY;
			}

			assert(false, "Expected non-suppressed exception");
		} catch (e) {
			nt.FINALLY;
			assert(e == "e", "The expected exception is caught");
			ok = true;
		}

		assert(ok, "Test passed");
	},

	//
	// parameter error checks
	//
	"CRTK-SRC-J-1":
	function *(log, assert) {
		log("Test: start only accepts a function");
		try {
			start("stuff");
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-2":
	function *(log, assert) {
		log("Test: coroutine handle expects a function for await callback");
		try {
			var c = start(function *() {});
			c.await("stuff");
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-3":
	function *(log, assert) {
		log("Test: coroutine does not allow to await for itself");
		try {
			var c = start(function *() {
				c.await(SYNC), yield *SYNCW();
			});
			c.await(SYNC), yield *SYNCW();
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-4":
	function *(log, assert) {
		log("Test: new Awaiter() is not allowed");
		try {
			new Awaiter();
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-5":
	function *(log, assert) {
		log("Test: Awaiter expects a function for await callback");
		try {
			var c = Awaiter();
			c.await("stuff");
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-6":
	function *(log, assert) {
		log("Test: Checkpoint expects Awaitables");
		try {
			var c = Checkpoint.allOf("stuff");
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-7":
	function *(log, assert) {
		log("Test: new NowThen() is not allowed");
		try {
			new NowThen();
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-8":
	function *(log, assert) {
		log("Test: Checkpoint.allIn doesn't accept no-arg, non-array/dict or extra arg");
		try {
			Checkpoint.allIn();
			assert(false, "An error must be raised for no-arg");
		} catch (e) {
			assert(true, "The error raised correctly for no-arg");
		}

		try {
			Checkpoint.allIn("stuff");
			assert(false, "An error must be raised for non-array/dict");
		} catch (e) {
			assert(true, "The error raised correctly for non-array/dict");
		}

		try {
			Checkpoint.allIn([], 0);
			assert(false, "An error must be raised for extra arg");
		} catch (e) {
			assert(true, "The error raised correctly for extra arg");
		}

		try {
			Checkpoint.allIn([]).await(SYNC), yield *SYNCW();
			assert(true, "An error must not be raised for array");
		} catch (e) {
			assert(false, "The error raised incorrectly for array");
		}

		try {
			Checkpoint.allIn({}).await(SYNC), yield *SYNCW();
			assert(true, "An error must not be raised for dict");
		} catch (e) {
			assert(false, "The error raised incorrectly for dict");
		}
	},

	"CRTK-SRC-J-9":
	function *(log, assert) {
		log("Test: Checkpoint.anyIn doesn't accept no-arg, non-array/dict or extra arg");
		try {
			Checkpoint.anyIn();
			assert(false, "An error must be raised for no-arg");
		} catch (e) {
			assert(true, "The error raised correctly for no-arg");
		}

		try {
			Checkpoint.anyIn("stuff");
			assert(false, "An error must be raised for non-array/dict");
		} catch (e) {
			assert(true, "The error raised correctly for non-array/dict");
		}

		try {
			Checkpoint.anyIn([], 0);
			assert(false, "An error must be raised for extra arg");
		} catch (e) {
			assert(true, "The error raised correctly for extra arg");
		}

		try {
			Checkpoint.anyOf();
			Checkpoint.anyIn([]).await(SYNC), yield *SYNCW();
			assert(true, "An error must not be raised for array");
		} catch (e) {
			console.log(e);
			assert(false, "The error raised incorrectly for array");
		}

		try {
			Checkpoint.anyIn({}).await(SYNC), yield *SYNCW();
			assert(true, "An error must not be raised for dict");
		} catch (e) {
			assert(false, "The error raised incorrectly for dict");
		}
	},

	"CRTK-SRC-J-10":
	function *(log, assert) {
		log("Test: new Cancellation() is not allowed");
		try {
			new Cancellation();
			assert(false, "An error must be raised");
		} catch (e) {
			assert(true, "The error raised correctly");
		}
	},

	"CRTK-SRC-J-11":
	function *(log, assert) {
		log("Test: NowThen.aft only accepts functions");
		var nt = NowThen();
		try {
			nt.TRY;
			nt.aft("stuff");
			assert(false, "An error must be raised");
		} catch (e) {
			nt.FINALLY;
			assert(true, "The error raised correctly");
		}
	},

	//
	// issues
	//

	"CRTK-ISSUES-1":
	function *(log, assert) {
		log("Test: Awaiter() returns object with valid Function prototype");
		var aw = Awaiter();
		aw.apply(null, [null, 15]);
		var r = (aw.await(SYNC), yield *SYNCW());
		assert(r == 15, "Expected value delivered");
	},

	"CRTK-ISSUES-2":
	function *(log, assert) {
		log("Test: Checkpoint.anyOf unawaits the unused Awaitables");
		var awRaw = Awaiter(), callbacks = new Set();
		var aw = {
			await: function await(callback) {
				callbacks.add(callback);
				return awRaw.await(callback);
			},
			unawait: function unawait(callback) {
				callbacks.delete(callback);
				return awRaw.unawait(callback);
			},
			get done() {
				return awRaw.done;
			}
		};

		for (var i = 0; i < 10; i++) {
			Checkpoint.anyOf(aw, start(function *() {
				setTimeout(SYNC, 100), yield *SYNCW();
			})).await(SYNC), yield *SYNCW();
		}
		assert(callbacks.size == 0, "Unawait was applied to unused Awaitable-s");
	},

	"CRTK-ISSUES-3":
	function *(log, assert) {
		log("Test: cancellation message is delivered to cancellation callback");
		var got = false, c1 = start(function *() {
			setTimeout(SYNC, 100), yield *SYNCW.withCancel(
				function(msg) { got = msg; }
			);
		});
		c1.cancel("Y");
		try {
			c1.await(SYNC), yield *SYNCW();
			assert(false, "Expected a throw");
		} catch (e) {
		}
		assert(got == "Y", "Expected value passed from cancellation callback");
	},

	"CRTK-ISSUES-4":
	function *(log, assert) {
		log("Test: Checkpoint.done is set immediately for a null checkpoint");
		var cp = Checkpoint.allOf();
		assert(cp.done, "The .done is set correctly");
	},

	"CRTK-ISSUES-6":
	function *(log, assert) {
		log("Test: All ways of starting a coroutine work correctly, and coroutines return correctly");
		var cr, val, obj, thisCap, argsCap;

		// start with generator
		cr = start(function *(...args) {
			argsCap = args;
			setTimeout(SYNC, 10), yield *SYNCW();
			return 1;
		}, 2, 3);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 1, "coroutine started with generator returned expected value");
		assert(argsCap[0] == 2 && argsCap[1] == 3,
			"coroutine started with generator got expected arguments");

		// start method with generator
		cr = (obj = {
			m: function *(...args) {
				thisCap = this;
				argsCap = args;
				setTimeout(SYNC, 10), yield *SYNCW();
				return 101;
			}
		})[startMethod]("m", 102, 103);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 101, "coroutine method started with generator threw expected value");
		assert(argsCap[0] == 102 && argsCap[1] == 103,
			"coroutine method started with generator got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with generator got expected this");
		obj = null;

		// start with plain function
		cr = start(function (...args) {
			argsCap = args;
			return 201;
		}, 202, 203);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 201, "coroutine started with plain function returned expected value");
		assert(argsCap[0] == 202 && argsCap[1] == 203,
			"coroutine started with plain function got expected arguments");

		// start method with plain function
		cr = (obj = {
			m: function (...args) {
				thisCap = this;
				argsCap = args;
				return 301;
			}
		})[startMethod]("m", 302, 303);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 301, "coroutine method started with plain function returned expected value");
		assert(argsCap[0] == 302 && argsCap[1] == 303,
			"coroutine method started with plain function got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with plain function got expected this");
		obj = null;

		// start with async function
		cr = start(async function (...args) {
			var nt = NowThen();
			argsCap = args;
			await(setTimeout(nt.SYNC, 10), nt.SYNCW);
			return 401;
		}, 402, 403);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 401, "coroutine started with async function returned expected value");
		assert(argsCap[0] == 402 && argsCap[1] == 403,
			"coroutine started with generator got expected arguments");

		// start method with async function
		cr = (obj = {
			m: async function (...args) {
				var nt = NowThen();
				thisCap = this;
				argsCap = args;
				await(setTimeout(nt.SYNC, 10), nt.SYNCW);
				return 501;
			}
		})[startMethod]("m", 502, 503);
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 501, "coroutine method started with async function returned expected value");
		assert(argsCap[0] == 502 && argsCap[1] == 503,
			"coroutine method started with async function got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with async function got expected this");
		obj = null;

		// start with iterator
		cr = start(function *(...args) {
			argsCap = args;
			setTimeout(SYNC, 10), yield *SYNCW();
			return 601;
		}(602, 603));
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 601, "coroutine started with iterator returned expected value");
		assert(argsCap[0] == 602 && argsCap[1] == 603,
			"coroutine started with iterator got expected arguments");

		// start method with iterator
		cr = start((obj = {
			m: function *(...args) {
				thisCap = this;
				argsCap = args;
				setTimeout(SYNC, 10), yield *SYNCW();
				return 701;
			}
		}).m(702, 703));
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 701, "coroutine method started with iterator returned expected value");
		assert(argsCap[0] == 702 && argsCap[1] == 703,
			"coroutine method started with iterator got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with iterator got expected this");
		obj = null;

		// start with promise
		cr = start(async function (...args) {
			var nt = NowThen();
			argsCap = args;
			await(setTimeout(nt.SYNC, 10), nt.SYNCW);
			return 801;
		}(802, 803));
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 801, "coroutine started with promise returned expected value");
		assert(argsCap[0] == 802 && argsCap[1] == 803,
			"coroutine started with promise got expected arguments");

		// start method with promise
		cr = start ((obj = {
			m: async function (...args) {
				var nt = NowThen();
				thisCap = this;
				argsCap = args;
				await(setTimeout(nt.SYNC, 10), nt.SYNCW);
				return 901;
			}
		}).m(902, 903));
		val = (cr.await(SYNC), yield *SYNCW());
		assert(val == 901, "coroutine method started with promise returned expected value");
		assert(argsCap[0] == 902 && argsCap[1] == 903,
			"coroutine method started with promise got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with promise got expected this");
		obj = null;
	},

	"CRTK-ISSUES-6-1":
	function *(log, assert) {
		log("Test: All ways of starting a coroutine work correctly, and coroutines throw correctly");
		var cr, val = null, obj, thisCap, argsCap;

		// start with generator
		cr = start(function *(...args) {
			argsCap = args;
			setTimeout(SYNC, 10), yield *SYNCW();
			throw 1;
		}, 2, 3);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 1, "coroutine started with generator threw expected value");
		assert(argsCap[0] == 2 && argsCap[1] == 3,
			"coroutine started with generator got expected arguments");

		// start method with generator
		cr = (obj = {
			m: function *(...args) {
				thisCap = this;
				argsCap = args;
				setTimeout(SYNC, 10), yield *SYNCW();
				throw 101;
			}
		})[startMethod]("m", 102, 103);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 101, "coroutine method started with generator threw expected value");
		assert(argsCap[0] == 102 && argsCap[1] == 103,
			"coroutine method started with generator got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with generator got expected this");
		obj = null;

		// start with plain function
		cr = start(function (...args) {
			argsCap = args;
			throw 201;
		}, 202, 203);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 201, "coroutine started with plain function threw expected value");
		assert(argsCap[0] == 202 && argsCap[1] == 203,
			"coroutine started with plain function got expected arguments");

		// start method with plain function
		cr = (obj = {
			m: function (...args) {
				thisCap = this;
				argsCap = args;
				throw 301;
			}
		})[startMethod]("m", 302, 303);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 301, "coroutine method started with plain function threw expected value");
		assert(argsCap[0] == 302 && argsCap[1] == 303,
			"coroutine method started with plain function got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with plain function got expected this");
		obj = null;

		// start with async function
		cr = start(async function (...args) {
			var nt = NowThen();
			argsCap = args;
			await(setTimeout(nt.SYNC, 10), nt.SYNCW);
			throw 401;
		}, 402, 403);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 401, "coroutine started with async function threw expected value");
		assert(argsCap[0] == 402 && argsCap[1] == 403,
			"coroutine started with generator got expected arguments");

		// start method with async function
		cr = (obj = {
			m: async function (...args) {
				var nt = NowThen();
				thisCap = this;
				argsCap = args;
				await(setTimeout(nt.SYNC, 10), nt.SYNCW);
				throw 501;
			}
		})[startMethod]("m", 502, 503);
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 501, "coroutine method started with async function threw expected value");
		assert(argsCap[0] == 502 && argsCap[1] == 503,
			"coroutine method started with async function got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with async function got expected this");
		obj = null;

		// start with iterator
		cr = start(function *(...args) {
			argsCap = args;
			setTimeout(SYNC, 10), yield *SYNCW();
			throw 601;
		}(602, 603));
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 601, "coroutine started with iterator threw expected value");
		assert(argsCap[0] == 602 && argsCap[1] == 603,
			"coroutine started with iterator got expected arguments");

		// start method with iterator
		cr = start((obj = {
			m: function *(...args) {
				thisCap = this;
				argsCap = args;
				setTimeout(SYNC, 10), yield *SYNCW();
				throw 701;
			}
		}).m(702, 703));
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 701, "coroutine method started with iterator threw expected value");
		assert(argsCap[0] == 702 && argsCap[1] == 703,
			"coroutine method started with iterator got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with iterator got expected this");
		obj = null;

		// start with promise
		cr = start(async function (...args) {
			var nt = NowThen();
			argsCap = args;
			await(setTimeout(nt.SYNC, 10), nt.SYNCW);
			throw 801;
		}(802, 803));
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 801, "coroutine started with promise threw expected value");
		assert(argsCap[0] == 802 && argsCap[1] == 803,
			"coroutine started with promise got expected arguments");

		// start method with promise
		cr = start ((obj = {
			m: async function (...args) {
				var nt = NowThen();
				thisCap = this;
				argsCap = args;
				await(setTimeout(nt.SYNC, 10), nt.SYNCW);
				throw 901;
			}
		}).m(902, 903));
		try {
			cr.await(SYNC), yield *SYNCW();
		} catch (e) {
			val = e;
		}
		assert(val == 901, "coroutine method started with promise threw expected value");
		assert(argsCap[0] == 902 && argsCap[1] == 903,
			"coroutine method started with promise got expected arguments");
		assert(thisCap === obj,
			"coroutine method started with promise got expected this");
		obj = null;
	},
};

//
// test framework
// (it by itself will be an extra test by running all tests in async parallel)
//
var testResults = {};
start(function *() {
	console.log("---- Running tests... ----");
	var testAwaitables = new Array();
	for (let tcId in testCases) {
		// specify a test case ID on command line to run only it
		if (process.argv[2] && process.argv[2] != tcId) {
			continue;
		}
		if (tcId[0] != '*') {
			testResults[tcId] = false;
			let log = function(...msgs) {
					msgs[0] = `[${tcId}] ${msgs[0] || ''}`;
					console.log(...msgs);
				},
				assert = function(flag, description) {
					if(!flag) {
						log(`Assertion failed - ${description}`);
						var error = new Error(`Assertion failed - ${description}`);
						error.isAssertionFailure = true;
						throw error;
					} else {
						log(`Assertion passed - ${description}`);
					}
				}
			testAwaitables.push(start(function *() {
					try {
						yield *testCases[tcId](log, assert);
						testResults[tcId] = "passed";
						return `${tcId} passed`;
					} catch (e) {
						testResults[tcId] = e;
						throw e;
					}
				}
			));
		}
	}
	Checkpoint.allOf(testAwaitables).await(SYNC), yield *SYNCW();
}).await(function (err, result) {
	console.log("---- Tests run complete ----");
	if (err) { console.log(`${(err.errors && err.errors.length && (err.errors.length + " ")) || ""}FAILURE(S) ENCOUNTERED\n---\n` + err + "\n" + err.stack); }
	else { console.log("SUCCESS"); }

	console.log("---- Breakdown ----");
	for (var tcId in testResults) {
		console.log(`${tcId}: ${testResults[tcId].stack || testResults[tcId]}`);
	}
});

module.exports.test = "qq";
