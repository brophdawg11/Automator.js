/* ========================================================================
 * Automator.js v0.1
 * A minimal JavaScript library for automating practically anything
 * in Javascript.
 *
 * Copyright (c) 2013 Matt Brophy (brophy.org)
 * https://github.com/brophdawg11/Automator.js
 *
 * Author: Matt Brophy
 * Website: http://www.brophy.org/
 *
 * Released under the MIT license
 * https://github.com/brophdawg11/Automator.js/blob/master/LICENSE
 * ------------------------------------------------------------------------ */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else if (typeof exports === 'object') {
        // Node.js
        module.exports = factory();
    } else {
        // Browser globals
        root.Automator = factory();
    }
}(this, function () {

    // Utility function to see if an object is promise-like
    function isPromise(p) {
        return p &&
               typeof p.done === 'function' &&
               typeof p.fail === 'function' &&
               typeof p.always === 'function' &&
               typeof p.then === 'function';
    }

    // Utility function to check if an object is an array
    function isArray(a) {
        if ('isArray' in Array) {
            return Array.isArray(a);
        }

        return Object.prototype.toString.call(a) === '[object Array]';
    }

    function Automator(options) {

        // Initialization
        // --------------

        var key,

            // Array of actions to automate
            actions,

            // interim actions returned from an executed function, executed
            // prior to the next step in 'actions'.  Maintained as a LIFO
            // stack of arrays of actions.  That way steps during interim
            // actions can return more interim actions
            interimActions,

            // Current action index
            actionIdx,

            // Number of iterations to run of the actions array
            numIterations,

            // Current iteration
            iterationIdx,

            // Callback function for each iteration
            iterationCb,

            // Final deferred
            finalDfd,

            // Have we been killed by the user
            killed;


        // Initialize options with default values
        options = typeof options === 'object' ? options : {};
        for (key in Automator.defaults) {
            if (typeof options[key] === 'undefined' || options[key === null]) {
                options[key] = Automator.defaults[key];
            }
        }

        // Private functions
        // -----------------

        // Logging function
        function debug() {
            if (options.debug) {
                var args = Array.prototype.slice.call(arguments);
                args.unshift("Automator.js: ");
                console.log.apply(console, args);
            }
        }

        // Reset all internal state variables
        function resetState() {
            actions = [];
            interimActions = [];
            actionIdx = 0;
            numIterations = 1;
            iterationIdx = 0;
            finalDfd = new options.Deferred();
            killed = false;
        }

        // Return a function to be run after the specified delay
        function getDelayedFunction(func, delay) {
            if (typeof delay === 'number' && delay > 0) {
                debug('Sleeping for ' + delay + 'ms');
                return setTimeout.bind(null, func, delay);
            }
            return func;
        }

        // Utility function to run a specified callback, potentially after a
        // promise is resolved.
        function runAfterPromise(func, maybePromise) {
            if (isPromise(maybePromise)) {
                // Defer step until the promise is resolved
                debug("Deferring next step until the promise is resolved");
                maybePromise.always(func);
            } else if (isArray(maybePromise)) {
                if (maybePromise.length > 0) {
                    debug("Received back an array of interim actions, " +
                          "running them now: ", maybePromise);
                    interimActions.unshift(maybePromise);
                }
                func();
            } else {
                debug("Passing value through to next step: ", maybePromise);
                func(maybePromise);
            }
        }

        // Execute a single step
        function step(passThrough) {
            var nextAction, action, type, handler, retVal, delay, deferredStep;

            // Did the user kill us?
            if (killed) {
                debug("was killed by user, exiting.");
                return;
            }

            // Are we done with our actions?
            if (actionIdx >= actions.length) {

                debug("iteration " + iterationIdx + " completed");

                // Did we have an iteration callback to run?
                if (typeof iterationCb === 'function') {
                    debug("Executing iteration callback");
                    retVal = iterationCb(iterationIdx);
                }

                // Are we done?
                if (++iterationIdx >= numIterations) {
                    debug("Done with iterations");
                    runAfterPromise(finalDfd.resolve, retVal);
                    return;
                }

                debug("Automator iteration " + iterationIdx + " ready to start");

                // Start back at the beginning
                actionIdx = 0;

                // Prep our next iteration after a delay, if requested
                deferredStep = getDelayedFunction(step, options.iterationDelay);

                // Run the next step after a potential promise is resolved
                runAfterPromise(deferredStep, retVal);

                return;
            }

            // Get the next action
            if (interimActions.length > 0) {
                // Get from the top array in the stack
                action = interimActions[0].shift();

                // If we just removed the last interim action from this top
                // entry in the stack, pop off the empty array
                if (interimActions[0].length === 0) {
                    interimActions.shift();
                }
            } else {
                // Increment after grab
                action = actions[actionIdx++];
            }

            // Peek ahead
            if (interimActions.length > 0) {
                // We still have interims
                nextAction = interimActions[0][0];
            } else {
                nextAction = actions[actionIdx];
            }

            // Short circuit on bad actions
            if (action == null) {
                // Skip it and move on
                debug("Skipping null action");
                step();
                return;
            }

            debug('Handling action: ' + action);

            // Pass off to the apropriate handler
            type = (typeof action);
            if      (type === 'number')   {
                handler = options.doNumber;
            } else if (type === 'string') {
                handler = options.doString;
            } else if (type === 'function') {
                handler = options.doFunction;
            } else {
                throw "Unsupported type!";
            }

            // Don't front or back pad numbers with a delay,
            // and don't delay at the end of the array
            if (type === 'number' ||
                typeof nextAction === 'number' ||
                nextAction == null) {
                delay = 0;
            } else {
                delay = options.stepDelay;
            }

            // Prep our next step after a delay, if requested
            deferredStep = getDelayedFunction(step, delay);

            // Run the handler, then move onto the next step, potentially
            // after a returned promise resolution
            retVal = handler.call(null, action, passThrough);
            runAfterPromise(deferredStep, retVal);
        }

        // Internal function to expand repeated string functionality
        function expandActions(arr) {
            var expanded = [],
                action,
                matches,
                num,
                i = -1,
                len = arr.length;

            while (++i < len) {
                action = arr[i];
                if (typeof action === 'string') {
                    // Look for trailing ...x<num>
                    matches = action.match(/(.*)+x(\d+)$/);
                    if (matches && matches.length === 3) {
                        action = matches[1];
                        num = parseInt(matches[2], 10);

                        // Add n duplicates of this string and continue
                        while (num-- > 0) { expanded.push(action); }
                        continue;
                    }
                }

                // Copy non-x<num> strings and any non strings straight over
                expanded.push(action);
            }

            return expanded;
        }

        // Public functions
        // ----------------

        this.automate = function (arr, num, cb) {
            // TODO: Validate input
            num = (typeof num === 'number') ? num : 1;

            // Wipe the slate clean
            resetState();

            // Create an expanded array of actions
            actions = expandActions(arr);

            // Store off the number of iterations
            numIterations = num;

            // Store off the iteration callback function
            iterationCb = cb;

            // Go!
            step();

            return finalDfd.promise();
        };

        // Kill the automator
        this.kill = function () {
            killed = true;
        };

    }

    // Supported string -> keyCode map
    Automator.keyCodeMap = {
        '0': 48,
        '1': 49,
        '2': 50,
        '3': 51,
        '4': 52,
        '5': 53,
        '6': 54,
        '7': 55,
        '8': 56,
        '9': 57,
        'a': 65,
        'b': 66,
        'c': 67,
        'd': 68,
        'e': 69,
        'f': 70,
        'g': 71,
        'h': 72,
        'i': 73,
        'j': 74,
        'k': 75,
        'l': 76,
        'm': 77,
        'n': 78,
        'o': 79,
        'p': 80,
        'q': 81,
        'r': 82,
        's': 83,
        't': 84,
        'u': 85,
        'v': 86,
        'w': 87,
        'x': 88,
        'y': 89,
        'z': 90,
        'left': 37,
        'up': 38,
        'right': 39,
        'down': 40,
        'enter': 13,
        'tab': 9,
        'ctrl': 17,
        'esc': 27,
        'space': 32
    };

    // Default handling of numbers - sleep for specified milliseconds
    Automator.doNumber = function (n, passThrough) {
        var dfd = new $.Deferred();
        setTimeout(dfd.resolve.bind(dfd, passThrough), n);
        return dfd.promise();
    };

    // Default handling of functions - passthrough execution
    Automator.doFunction = function (func, passThrough) {
        return func.call(null, passThrough);
    };

    // Utility function for simulating a key event
    Automator.simulateKeyEvent = function (type, keyCode) {
        // From http://stackoverflow.com/questions/596481/simulate-javascript-key-events
        var eventObj = document.createEventObject ?
                       document.createEventObject() :
                       document.createEvent("Events");


        if (typeof eventObj.initEvent === 'function') {
            eventObj.initEvent("keydown", true, true);
        }

        eventObj.keyCode = keyCode;
        eventObj.which = keyCode;

        if (typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(eventObj);
        } else {
            document.fireEvent("onkeydown", eventObj);
        }
    };

    // Default handling of strings - simulate keypress of the specified key
    Automator.doString = function (str, passThrough) {
        var keyCode = Automator.keyCodeMap[str];

        if (typeof keyCode !== 'number') { return; }

        return Automator.simulateKeyEvent("keydown", keyCode);
    };

    // No default handling of objects
    Automator.doObject = function (obj, passThrough) {};

    // Default options
    Automator.defaults = {
        debug: false,
        stepDelay: 0,
        iterationDelay: 0,
        Deferred: $.Deferred,
        doNumber: Automator.doNumber,
        doFunction: Automator.doFunction,
        doString: Automator.doString,
        doObject: Automator.doObject
    };

    return Automator;

}));
