# promiseWorker

A quick inline web worker implementation for firing off long running JS and getting the result back in the form of a promise. Should work on IE 11+ and modern versions of Safari/Firefox/Chrome.

# Usage

Wrap web workers in a promise interface. create like:

```
var w = promiseWorker.create(function(input){
    return input + 2;
});

w(3).then(function(res){ /* res == 5 */ });
```

You can also return promises inside the worker function eg:

```
var w = promiseWorker.create(function(input){
    return new Promise(function(res){
        setTimeout(function(){ res(input + 2) }, 5000);
    });
});

w(3).then(function(res){ /* res == 5 */ });
```

And any errors thrown during the running of the worker will be
turned into promise rejections:

```
var w = promiseWorker.create(function(input){
    throw Error("aaah");
});

w().catch(function(err){ /* err.message == aaah */ });
```

Workers can be killed at any point after they are instantiated with
an input value. The resulting promise is rejected:

```
var w = promiseWorker.create(function(input){
    while(true){  }
});

w().catch(function(err){ /* err.message == WORKER_TERMINATED */ }).terminate();
```

Workers can also send notifications to the outside thread as often as they like,
which uses postMessage and structured cloning under the hood. One can unsubscribe
from notifications by running the callback provided back. You can use this.notify to
avoid JShint warnings if you prefer:

```
var w = promiseWorker.create(function(input){
    notify("first message");
    this.notify("second message");
});

var unsub = w().notify(function(msg){ /* received "first message" then "second message" */ });
unsub() //unsubscribe from notifications.
```

For debugging, console.log and console.error are made available
in worker contexts as well. note that worker functions do NOT have
access to anything outside of their scope.
