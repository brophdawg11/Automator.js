Automator.js
============

A minimal JavaScript library (3.2k minified) for automating practically anything in Javascript.

[Annotated Source Code](https://rawgithub.com/brophdawg11/Automator.js/master/docs/automator.html) |
[Unit Tests](https://rawgithub.com/brophdawg11/Automator.js/master/tests.html)

The purpose of an Automator is to accept an Array of steps, and to automate them for you.  It's that simple.

    // Press right, sleep for 1000ms, press left, sleep for 1000ms
    var automator = new Automator();
    automator.automate([ 'right', 1000, 'left', 1000 ]);

While trying to provide some useful defaults, the Automator leaves the behavior of each step entirely up to you.  The behavior of a step is determined by the `typeof` the step (number, string, function, object).  Automator attempts to provide some useful default functionality:

* *Number*: Sleep for N milliseconds with setTimeout
* *String*: Simulate a key press for the given key.  Supports letters, numbers, arrows, and a series of standard keys (ctrl, alt, enter, etc.).  Please refer to the full documentation for details.
* *Function*: Execute the given function.  If the function returns a jQuery Promise, the following step will be deferred until the Promise is resolved.
* *Object*: No default behavior provided

The behavior of each of these can be customized through the options passed to the Automator constructor:

    // Lets treat numbers as seconds instead of milliseconds
    var automator = new Automator({
        doNumber: function (n) {
            var dfd = new Automator.MiniDeferred();
            setTimeout(dfd.resolve, n * 1000);
            return dfd.promise();
        },
        // doFunction: function (func) { ... },
        // doString: function (str) { ... },
        // doObject: function (obj) { ... }
    });
    automator.automate([ 'right', 1, 'left', 1 ]);

    // Alternatively, you can proxy the default functions
    var automator = new Automator({
        doNumber: function (n) {
            return Automator.doNumber(n * 1000);
        }
    });
    automator.automate([ 'right', 1, 'left', 1 ]);


### Repetition ###
Want to run steps repeatedly?  Automator supports repetition at the step level for string values:

    // Any string ending in /x[0-9]+/ will be repeated that many times, so:
    automator.automate([ 'rightx3', 1000, 'leftx3', 1000 ]);

    // Is exactly equivalent to
    automator.automate([ 'right', 'right', 'right', 1000, 'left', 'left', 'left', 1000 ]);


Want to run full automations repeatedly?  This is just as easy:

    function sequenceCb(i) {
        console.log("Done with iteraton " + i);
    }

    // The optional second parameter to automate() is how many times to run the sequence
    // The optional third parameter is a callback function to run after each sequence

    // Run the full sequence 3 times
    automator.automate([ 'right', 1000, 'left', 1000 ], 3, sequenceCb);


Want to do something at the very end of the entire, potentially repeated,
sequence?  The automate() function returns a Promise-esque object you can
hook into:

    // Run the full sequence 3 times
    automator.automate([ 'right', 1000, 'left', 1000 ], 3).then(function () {
      console.log("I'm all done!");
    });

*Note:* This Promise-esque object is by no means a full-featured promise object.
In order to avoid dependencies, Automator has it's own Automator.MiniDeferred implementation that simply implements basic resolve/reject/done/fail/always callbacks.  If you would like to use a more full-featured implementation,
simply specify that implemnentation in options.Deferred.  The Deferred object is expected to implement the same API as Automator.MiniDeferred.  For example:

    var automator = new Automator({
        Deferred: $.Deferred
    });

    a.automate(['left', 'right'])
    // Returns a jQuery Promise


### Async ###

Want to be asynchronous?  No problem.  Any step in an Automator sequence that returns a jQuery Deferred-esque object will cause the following step to wait
upon resolution or rejection of the promise.

    var automator = new Automator();

    function doAsync () {
        var dfd = new $.Deferred();
        // Do something asynchronous and resolve deferred
        return dfd.promise();
    }

    // The 'right' step will not execute until after the asynchronous operation has completed.
    automator.automate([doAsync, 'right']);

### Interim steps ###

If you need to execute a few dynamic steps, potentially ones that rely on the state of your applicaton or a previous step, just return an array from an Automator step.  This array of steps will be inserted into the sequence immediately after the current step.

    var automator = new Automator();

    function addSteps () {
        return ['up', 'down'];
    }

    // The full sequence will run as: right, up, down, left
    automator.automate(['right', addSteps, 'left']);


### Pass-through values ###

Any return values from Automator steps that are not a Promise or an Array will simply be passed through to the next step in the process.

    var automator = new Automator();

    function createVal () {
        return Math.random();
    }

    function handleVal(randomNum) {
        console.log("I got the random number: " + randomNum);
    }

    automator.automate([createVal, handleVal]);


### Additional configuration options ###

* *debug* [false] - Boolean value to turn on Automator debugging messages in the console
* *stepDelay* [0] - Milliseconds to sleep between steps.  Because numbers are treated as delays, this delay is ignored before and after numeric steps.
* *iterationDelay* [0] - Milliseconds to sleep between sequence iterations


#### A note on key events ####

The default behavior for strings (left, right, etc.) is to mimic a keydown event.  For simplicity, keyup events are not sent, but it's very easy to provide a keyup event after a delay.  Something like the following would work:

    var automator = new Automator({
        doString: function(str) {
            var keyCode = Automator.keyCodeMap[str],
                dfd = new Automator.MiniDeferred();

            if (typeof keyCode !== 'number') { return; }

            // Inherit the standard keydown behavior
            Automator.simulateKeyEvent('keydown', keyCode);

            // Perform the keyup event after a delay
            // then tell Automator we're done with this step
            setTimeout(function () {
                Automator.simulateKeyEvent('keyup', keyCode);
                dfd.resolve();
            }, 100);

            // Force subsequent steps to wait for the keyup event
            return dfd.promise();
        }
    });


#### Anticipated, but unimplemented functionality ####

* Lots more cross browser testing.  Currently developed and tested in Chrome 31
