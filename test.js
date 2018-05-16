#!/usr/bin/env node

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
						console.log("OK");
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
						throw new Error(`Assertion failed - ${description}`);
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
