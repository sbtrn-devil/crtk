const {
	start,
	startMethod,
	Awaiter,
	Checkpoint,
	Cancellation,
	CheckpointResult
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
		if (tcId[0] != '*') {
			testResults[tcId] = false;
			let log = function(...msgs) {
					msgs[0] = `[${tcId}] ${msgs[0] || ''}`;
					console.log(...msgs);
				},
				assert = function(flag, description) {
					if(!flag) {
						throw new Error(`Assertion failed - ${description}`);
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
