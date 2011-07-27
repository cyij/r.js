/**
 * @license Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */

/*jslint regexp: false, strict: false  */
/*global define: false */

define(function () {

    function Temp() {}

    function create(obj, mixin) {
        Temp.prototype = obj;
        var temp = new Temp(), prop;

        //Avoid any extra memory hanging around
        Temp.prototype = null;

        if (mixin) {
            for (prop in mixin) {
                if (mixin.hasOwnProperty(prop) && !(prop in temp)) {
                    temp[prop] = mixin[prop];
                }
            }
        }

        return temp; // Object
    }

    var pragma = {
        conditionalRegExp: /(exclude|include)Start\s*\(\s*["'](\w+)["']\s*,(.*)\)/,
        useStrictRegExp: /['"]use strict['"];/g,
        hasRegExp: /has\s*\(\s*['"]([^'"]+)['"]\)/g,

        removeStrict: function (contents, config) {
            return config.useStrict ? contents : contents.replace(pragma.useStrictRegExp, '');
        },

        /**
         * processes the fileContents for some //>> conditional statements
         */
        process: function (fileName, fileContents, config, onLifecycleName) {
            /*jslint evil: true */
            var foundIndex = -1, startIndex = 0, lineEndIndex, conditionLine,
                matches, type, marker, condition, isTrue, endRegExp, endMatches,
                endMarkerIndex, shouldInclude, startLength, lifecycleHas,
                lifecyclePragmas, pragmas = config.pragmas, hasConfig = config.has,
                //Legacy arg defined to help in dojo conversion script. Remove later
                //when dojo no longer needs conversion:
                kwArgs = pragmas;

            //Mix in a specific lifecycle scoped object, to allow targeting
            //some pragmas/has tests to only when files are saved, or at different
            //lifecycle events. Do not bother with kwArgs in this section, since
            //the old dojo kwArgs were for all points in the build lifecycle.
            if (onLifecycleName) {
                lifecyclePragmas = config['pragmas' + onLifecycleName];
                lifecycleHas = config['has' + onLifecycleName];

                if (lifecyclePragmas) {
                    pragmas = create(pragmas || {}, lifecyclePragmas);
                }

                if (lifecycleHas) {
                    hasConfig = create(hasConfig || {}, lifecycleHas);
                }
            }

            //Replace has references if desired
            if (hasConfig) {
                fileContents = fileContents.replace(pragma.hasRegExp, function (match, test) {
                    if (test in hasConfig) {
                        return !!hasConfig[test];
                    }
                    return match;
                });
            }

            //If pragma work is not desired, skip it.
            if (config.skipPragmas) {
                return pragma.removeStrict(fileContents, config);
            }

            while ((foundIndex = fileContents.indexOf("//>>", startIndex)) !== -1) {
                //Found a conditional. Get the conditional line.
                lineEndIndex = fileContents.indexOf("\n", foundIndex);
                if (lineEndIndex === -1) {
                    lineEndIndex = fileContents.length - 1;
                }

                //Increment startIndex past the line so the next conditional search can be done.
                startIndex = lineEndIndex + 1;

                //Break apart the conditional.
                conditionLine = fileContents.substring(foundIndex, lineEndIndex + 1);
                matches = conditionLine.match(pragma.conditionalRegExp);
                if (matches) {
                    type = matches[1];
                    marker = matches[2];
                    condition = matches[3];
                    isTrue = false;
                    //See if the condition is true.
                    try {
                        isTrue = !!eval("(" + condition + ")");
                    } catch (e) {
                        throw "Error in file: " +
                               fileName +
                               ". Conditional comment: " +
                               conditionLine +
                               " failed with this error: " + e;
                    }

                    //Find the endpoint marker.
                    endRegExp = new RegExp('\\/\\/\\>\\>\\s*' + type + 'End\\(\\s*[\'"]' + marker + '[\'"]\\s*\\)', "g");
                    endMatches = endRegExp.exec(fileContents.substring(startIndex, fileContents.length));
                    if (endMatches) {
                        endMarkerIndex = startIndex + endRegExp.lastIndex - endMatches[0].length;

                        //Find the next line return based on the match position.
                        lineEndIndex = fileContents.indexOf("\n", endMarkerIndex);
                        if (lineEndIndex === -1) {
                            lineEndIndex = fileContents.length - 1;
                        }

                        //Should we include the segment?
                        shouldInclude = ((type === "exclude" && !isTrue) || (type === "include" && isTrue));

                        //Remove the conditional comments, and optionally remove the content inside
                        //the conditional comments.
                        startLength = startIndex - foundIndex;
                        fileContents = fileContents.substring(0, foundIndex) +
                            (shouldInclude ? fileContents.substring(startIndex, endMarkerIndex) : "") +
                            fileContents.substring(lineEndIndex + 1, fileContents.length);

                        //Move startIndex to foundIndex, since that is the new position in the file
                        //where we need to look for more conditionals in the next while loop pass.
                        startIndex = foundIndex;
                    } else {
                        throw "Error in file: " +
                              fileName +
                              ". Cannot find end marker for conditional comment: " +
                              conditionLine;

                    }
                }
            }

            return pragma.removeStrict(fileContents, config);
        }
    };

    return pragma;
});