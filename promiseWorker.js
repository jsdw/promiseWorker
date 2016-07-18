//
// Wrap web workers in a promise interface.
//
window.promiseWorker = (function(){

	var RESOLVE = 1, REJECT = 2, NOTIFY = 3, LOG = 4, ERROR = 5;

	function makeFunc(fn){
		return [
			  "var worker = self;"
			, "var _RESOLVE = 1, _REJECT = 2, _NOTIFY = 3, _LOG = 4, _ERROR = 5;"
			, "var notify = function(out){"
			, "    worker.postMessage({ state: _NOTIFY, result: out })"
			, "};"
			, "var console = {"
			, "    log: function(){"
			, "        worker.postMessage({ state: _LOG, result: Array.prototype.slice.call(arguments) })"
			, "    },"
			, "    error: function(){"
			, "        worker.postMessage({ state: _ERROR, result: Array.prototype.slice.call(arguments) })"
			, "    }"
			, "};"
			, "var myFunc = (function(){"
			, "    var worker = null, self = null;" //hide globals from provided func.
			, "    return " + fn.toString() + ";"
			, "}());"
			, "worker.onmessage = function(ev){"
			, "    var msg = ev.data;"
			, "    var resolve"
			, "    var p = new Promise(function(_resolve){"
			, "        resolve = _resolve;"
			, "    });"
			, "    p.then("
			, "        function(res){ worker.postMessage({ state: _RESOLVE, result: res}); worker.close() },"
			, "        function(err){ worker.postMessage({ state: _REJECT, result: err}); worker.close() }"
			, "    );"
			, "    resolve( myFunc.call({ notify: notify }, msg) );"
			, "};"
			].join("\n");
	}

	return {

		create: function(fn){

			var fnString = makeFunc(fn);
			var blob = new Blob([fnString], { type: 'application/javascript' });
			var url = URL.createObjectURL(blob);

			var out = function(input){

				var resolve, reject;
				var notifyCallbacks = [];
				var w = new Worker(url);
				var p = new Promise(function(_resolve, _reject){
					resolve = _resolve;
					reject = _reject;
				});

				w.onmessage = function(ev){
					var msg = ev.data;
					switch(msg.state){
						case RESOLVE: resolve(msg.result); w.terminate(); break;
						case REJECT: reject(msg.result); w.terminate(); break;
						case NOTIFY: notifyCallbacks.forEach(function(cb){ cb(msg.result) }); break;
						case LOG: console.log.apply(console, msg.result); break;
						case ERROR: console.error.call(console, msg.result); break;
						default: throw Error("worker.compile: received unexpected response: "+JSON.stringify(ev));
					}
				};

				//any worker error turns into a promise rejection:
				w.onerror = function(ev){
					w.terminate();
					if(reject) reject(ev);
					ev.preventDefault();
				}

				//explicit killing (.terminate) turns into a promise rejection:
				var kill = function(){
					w.terminate();
					notifyCallbacks = [];
					if(reject) reject(Error("WORKER_TERMINATED"));
				};

				//allow messages to be streamed out from workers:
				var notify = function(cb){
					notifyCallbacks.push(cb);
					return function(){
						notifyCallbacks.filter(function(fn){ return fn !== cb });
					}
				};

				//ensure promises always have .terminate method:
				function wrapPromise(p){
					p.terminate = kill;
					p.notify = notify;

					var _catch = p.catch;
					p.catch = function(fn){
						return wrapPromise(_catch.call(p, fn));
					}
					var _then = p.then;
					p.then = function(res, err){
						return wrapPromise(_then.call(p, res, err));
					}
					return p;
				}

				//delay post to next frame so we are certain any
				//chains of this and notify are evaluated before worker
				//runs:
				setTimeout(function(){ w.postMessage(input); },0);
				return wrapPromise(p);

			};


			return out;

		}

	};

}());