function getArgs(func) {
    // First match everything inside the function argument parens.
    var args = func.toString().replace('async','').replace('*','').trim().match(/function\s.*?\(([^)]*)\)/)[1];
   
    // Split the arguments string into an array comma delimited.
    return args.split(',').map(function(arg) {
      // Ensure no inline comments are parsed and trim the whitespace.
      return arg.replace(/\/\*.*\*\//, '').trim();
    });
}

/*
    function example_fn(arg1, arg2, arg3) {
        assert_not_undefined(example_fn, arguments);
    }
*/
function assert_not_undefined(func, args) {
    args = Array.from(args);
    let arg_names = getArgs(func);
    console.assert(arg_names.length === args.length, arg_names.length, 'names:', arg_names, '\t', args.length, 'arguments:', args);
    let undefined_args = [];
    for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] === 'undefined') {
            undefined_args.push(arg_names[i])
        }
    }
    if (undefined_args.length !== 0) {
        throw new Error('These arguments where undefined:', undefined_args);
    }
}

module.exports = {
    assert_not_undefined: assert_not_undefined
}