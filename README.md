Automator.js
============

A minimal JavaScript library for automating practically anything in Javascript.

[Documentation](https://rawgithub.com/brophdawg11/Automator.js/master/docs/automator.html) |
[Unit Tests](https://rawgithub.com/brophdawg11/Automator.js/master/tests.html)

The purpose of an Automator is to accept an Array of steps, and to automate them for you.  It's that simple.

    // Press right, sleep for 1000ms, press left, sleep for 1000ms
    var automator = new Automator();
    automator.automate([ 'right', 1000, 'left', 1000 ]);

While trying to provide some useful defaults, the Automator leaves the behavior of each step entirely up to you.  Each step is no more than execution of a bit of JavaScript code, so there are no limitations on what a step can do.  The behavior of a step is determined by the `typeof` the step (number, string, function, object).  Automator attempts to provide some useful default functionality:

* *Number*: Sleep for N milliseconds with setTimeout
* *String*: Simulate a key press for the given key.  Supports letters, numbers, arrows, and a series of standard keys (ctrl, alt, enter, etc.).  Please refer to the full documentation for details.
* *Function*: Execute the given function.  If the function returns a jQuery Promise, the following step will be deferred until the Promise is resolved.
* *Object*: No default behavior provided

The behavior of each of these can be customized through the options passed to the Automator constructor:

    // Lets treat numbers as seconds instead of milliseconds
    var automator = new Automator({
        doNumber: function (n) {
            var dfd = new $.Deferred();
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

Want to run steps repeatedly?  Automator supports repetition at the step level for string values:

    // Any string ending in /x[0-9]+/ will be repeated that many times, so:
    automator.automate([ 'rightx3', 1000, 'leftx3', 1000 ]);

    // Is exactly equivalent to
    automator.automate([ 'right', 'right', 'right', 1000, 'left', 'left', 'left', 1000 ]);


Want to run full automations repeatedly?  This is just as easy:

    // The optional second parameter to automate() is how many times to run the sequence
    // The optional third parameter is a callback function to run after each sequence
    function sequenceCb(i) {
        console.log("Done with iteraton " + i);
    }

    // Run the full sequence 3 times
    automator.automate([ 'right', 1000, 'left', 1000 ], 3, sequenceCb);


Additional configuration options:

* *debug* [false] - Boolean value to turn on Automator debugging messages in the console
* *stepDelay* [0] - Milliseconds to sleep between steps.  Because numbers are treated as delays, this delay is ignored before and after numeric steps.
* *iterationDelay* [0] - Milliseconds to sleep between sequence iterations

