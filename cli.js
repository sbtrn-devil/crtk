#!/usr/bin/env node

const {
	start
} = require("./index.js");

var jsFileAndName = process.argv[2], jsArgs = process.argv.slice(3), help;
if (jsFileAndName === undefined || (help = jsFileAndName.match(/^(-h|--help)$/))) {
	console.log("Usage: crtk-run <file.js>[:name] [<arg> ...]")
	console.log("");
	console.log("Run function or generator exported by file.js in module.exports[name]");
	console.log("or module.exports itself if :name is not provided, as a coroutine.");
	console.log("<arg> and subsequent args are passed as parameters to the function.");
	console.log("")
	process.exit(help ? 0 : 1);
}

// absolute or relative path
var pathPrefix = jsFileAndName.match(/^([A-Za-z]+:|[\/\\])/) ? "" : process.cwd() + "/",
	fileAndNameMatches = jsFileAndName.match(/(.*?)(:([^\/\\]*))?$/),
	jsFile = fileAndNameMatches[1],
	jsExportName = fileAndNameMatches[3],
	jsExports = require(pathPrefix + jsFile),
	toRun = jsExportName ? jsExports[jsExportName] : jsExports;

if (typeof(toRun) != 'function') {
	console.log ((jsExportName ? "module.exports[" + jsExportName + "]" :
		"module.exports") + " in " + jsFile + " is not a function or generator");
	process.exit(1);
}


start(toRun, ...jsArgs).await(function finalize(err, result) {
	if (err) { throw err; }
});