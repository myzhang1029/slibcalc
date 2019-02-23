// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = true;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}


// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)




// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process === 'object' && typeof require === 'function') || typeof window === 'object' || typeof importScripts === 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  abort('staticAlloc is no longer available at runtime; instead, perform static allocations at compile time (using makeStaticAlloc)');
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end <= _emscripten_get_heap_size()) {
    HEAP32[DYNAMICTOP_PTR>>2] = end;
  } else {
    return 0;
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);


// 'sig' parameter is currently only used for LLVM backend under certain
// circumstance: RESERVED_FUNCTION_POINTERS=1, EMULATED_FUNCTION_POINTERS=0.
function addFunction(func, sig) {

  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';

}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
}

var getTempRet0 = function() {
  return tempRet0;
}

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;




// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html




/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}




// Wasm globals

var wasmMemory;

// Potentially used for direct table calls.
var wasmTable;


//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_DYNAMIC = 2; // Cannot be freed except through sbrk
var ALLOC_NONE = 3; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc,
    stackAlloc,
    dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}




/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!");
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}





function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (y + ' [' + x + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}



// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}


var STATIC_BASE = 8,
    STACK_BASE = 1984,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5244864,
    DYNAMIC_BASE = 5244864,
    DYNAMICTOP_PTR = 1728;

assert(STACK_BASE % 16 === 0, 'stack must start aligned');
assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');



var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');







// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


  HEAP32[0] = 0x63736d65; /* 'emsc' */



// Endianness check (note: assumes compiler arch was little-endian)
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;



// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





// STATICTOP = STATIC_BASE + 1976;
/* global initializers */  __ATINIT__.push({ func: function() { ___emscripten_environ_constructor() } });


memoryInitializer = "data:application/octet-stream;base64,AAAAAAAAAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAwAAAJgAAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEA==";





/* no memory initializer */
var tempDoublePtr = 1968
assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}

// {{PRE_LIBRARY}}


  
  var ENV={};function ___buildEnvironment(environ) {
      // WARNING: Arbitrary limit!
      var MAX_ENV_VALUES = 64;
      var TOTAL_ENV_SIZE = 1024;
  
      // Statically allocate memory for the environment.
      var poolPtr;
      var envPtr;
      if (!___buildEnvironment.called) {
        ___buildEnvironment.called = true;
        // Set default values. Use string keys for Closure Compiler compatibility.
        ENV['USER'] = ENV['LOGNAME'] = 'web_user';
        ENV['PATH'] = '/';
        ENV['PWD'] = '/';
        ENV['HOME'] = '/home/web_user';
        ENV['LANG'] = 'C.UTF-8';
        ENV['_'] = Module['thisProgram'];
        // Allocate memory.
        poolPtr = getMemory(TOTAL_ENV_SIZE);
        envPtr = getMemory(MAX_ENV_VALUES * 4);
        HEAP32[((envPtr)>>2)]=poolPtr;
        HEAP32[((environ)>>2)]=envPtr;
      } else {
        envPtr = HEAP32[((environ)>>2)];
        poolPtr = HEAP32[((envPtr)>>2)];
      }
  
      // Collect key=value lines.
      var strings = [];
      var totalSize = 0;
      for (var key in ENV) {
        if (typeof ENV[key] === 'string') {
          var line = key + '=' + ENV[key];
          strings.push(line);
          totalSize += line.length;
        }
      }
      if (totalSize > TOTAL_ENV_SIZE) {
        throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
      }
  
      // Make new.
      var ptrSize = 4;
      for (var i = 0; i < strings.length; i++) {
        var line = strings[i];
        writeAsciiToMemory(line, poolPtr);
        HEAP32[(((envPtr)+(i * ptrSize))>>2)]=poolPtr;
        poolPtr += line.length + 1;
      }
      HEAP32[(((envPtr)+(strings.length * ptrSize))>>2)]=0;
    }

  function ___lock() {}

  
  var SYSCALLS={buffers:[null,[],[]],printChar:function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in FILESYSTEM=0
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  function _abort() {
      Module['abort']();
    }

  function _emscripten_get_heap_size() {
      return TOTAL_MEMORY;
    }

  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }function _emscripten_resize_heap(requestedSize) {
      abortOnCannotGrowMemory(requestedSize);
    }

  
  var _Math_floor=undefined;
  
  var _Math_ceil=undefined; 

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }
  
  var _Int8Array=undefined;
  
  var _Int32Array=undefined; 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    } 
var ASSERTIONS = true;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


// ASM_LIBRARY EXTERN PRIMITIVES: Math_floor,Math_ceil,Int8Array,Int32Array


function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

var asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Float32Array": Float32Array, "Float64Array": Float64Array }

var asmLibraryArg = { "abort": abort, "setTempRet0": setTempRet0, "getTempRet0": getTempRet0, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "___buildEnvironment": ___buildEnvironment, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_abort": _abort, "_emscripten_get_heap_size": _emscripten_get_heap_size, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_resize_heap": _emscripten_resize_heap, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "tempDoublePtr": tempDoublePtr, "DYNAMICTOP_PTR": DYNAMICTOP_PTR }
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';

  var HEAP8 = new global.Int8Array(buffer),
  HEAP32 = new global.Int32Array(buffer),
  HEAPU8 = new global.Uint8Array(buffer),
  HEAPF32 = new global.Float32Array(buffer),
  HEAPF64 = new global.Float64Array(buffer),
  tempDoublePtr=env.tempDoublePtr|0,
  DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0,
  __THREW__ = 0,
  threwValue = 0,
  setjmpId = 0,
  tempInt = 0,
  tempBigInt = 0,
  tempBigIntS = 0,
  tempValue = 0,
  tempDouble = 0.0,
  Math_floor=global.Math.floor,
  Math_sqrt=global.Math.sqrt,
  Math_cos=global.Math.cos,
  Math_sin=global.Math.sin,
  Math_acos=global.Math.acos,
  Math_asin=global.Math.asin,
  Math_ceil=global.Math.ceil,
  Math_imul=global.Math.imul,
  abort=env.abort,
  setTempRet0=env.setTempRet0,
  getTempRet0=env.getTempRet0,
  abortStackOverflow=env.abortStackOverflow,
  nullFunc_ii=env.nullFunc_ii,
  nullFunc_iiii=env.nullFunc_iiii,
  ___buildEnvironment=env.___buildEnvironment,
  ___lock=env.___lock,
  ___setErrNo=env.___setErrNo,
  ___syscall140=env.___syscall140,
  ___syscall146=env.___syscall146,
  ___syscall54=env.___syscall54,
  ___syscall6=env.___syscall6,
  ___unlock=env.___unlock,
  _abort=env._abort,
  _emscripten_get_heap_size=env._emscripten_get_heap_size,
  _emscripten_memcpy_big=env._emscripten_memcpy_big,
  _emscripten_resize_heap=env._emscripten_resize_heap,
  abortOnCannotGrowMemory=env.abortOnCannotGrowMemory,
  flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM,
  STACKTOP = 1984,
  STACK_MAX = 5244864,
  tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
    if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function _slib_rad2deg($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 * 180.0;
 $2 = $1 / 3.1415926535897931;
 return (+$2);
}
function _slib_deg2rad($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 * 3.1415926535897931;
 $2 = $1 / 180.0;
 return (+$2);
}
function _slib_sun_decl_by_date($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $1 = (($0) + 10)|0;
 $2 = (+($1|0));
 $3 = $2 * 0.98565000000000002;
 $4 = (($0) + -2)|0;
 $5 = (+($4|0));
 $6 = $5 * 0.98565000000000002;
 $7 = $6 * 3.1415926535897931;
 $8 = $7 / 180.0;
 $9 = (+Math_sin((+$8)));
 $10 = $9 * 1.9139999999999999;
 $11 = $3 + $10;
 $12 = $11 * 3.1415926535897931;
 $13 = $12 / 180.0;
 $14 = (+Math_cos((+$13)));
 $15 = $14 * 0.39778999999999998;
 $16 = (+Math_asin((+$15)));
 $17 = $16 * 180.0;
 $18 = $17 / 3.1415926535897931;
 $19 = - $18;
 return (+$19);
}
function _slib_sf_sunrise($0,$1,$2,$3,$4,$5,$6) {
 $0 = +$0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $7 = (+_slib_tm2jd($4));
 $8 = (+_llvm_round_f64((+$7)));
 $9 = (+_slib_julian_day($8));
 $10 = (+_slib_mean_solar_noon($9,$1));
 $11 = (+_slib_solar_mean_anomaly($10));
 $12 = (+_slib_equation_of_the_center_value($11));
 $13 = (+_slib_ecliptic_longitude($11,$12));
 $14 = (+_slib_sun_decl($13));
 $15 = (+_slib_solar_transit($10,$11,$13));
 $16 = (+_slib_corr_sunrise_hour_angle($0,$14,$2));
 $17 = $16 / 360.0;
 $18 = $15 - $17;
 $19 = $3 / 24.0;
 $20 = $19 + $18;
 _slib_jd2tm($20,$5);
 $21 = $15 + $17;
 $22 = $19 + $21;
 _slib_jd2tm($22,$6);
 return;
}
function _slib_julian_day($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 + -2451545.0;
 $2 = $1 + 8.0000000000000004E-4;
 return (+$2);
}
function _slib_mean_solar_noon($0,$1) {
 $0 = +$0;
 $1 = +$1;
 var $2 = 0.0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 / 360.0;
 $3 = $0 - $2;
 return (+$3);
}
function _slib_solar_mean_anomaly($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 * 0.98560027999999999;
 $2 = $1 + 357.52910000000003;
 $3 = $2 % 360.0;
 return (+$3);
}
function _slib_equation_of_the_center_value($0) {
 $0 = +$0;
 var $1 = 0.0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (+_slib_deg2rad($0));
 $2 = (+Math_sin((+$1)));
 $3 = $2 * 1.9148000000000001;
 $4 = $0 * 2.0;
 $5 = (+_slib_deg2rad($4));
 $6 = (+Math_sin((+$5)));
 $7 = $6 * 0.02;
 $8 = $3 + $7;
 $9 = $0 * 3.0;
 $10 = (+_slib_deg2rad($9));
 $11 = (+Math_sin((+$10)));
 $12 = $11 * 2.9999999999999997E-4;
 $13 = $8 + $12;
 return (+$13);
}
function _slib_ecliptic_longitude($0,$1) {
 $0 = +$0;
 $1 = +$1;
 var $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $0 + $1;
 $3 = $2 + 180.0;
 $4 = $3 + 102.9372;
 $5 = $4 % 360.0;
 return (+$5);
}
function _slib_solar_transit($0,$1,$2) {
 $0 = +$0;
 $1 = +$1;
 $2 = +$2;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $0 + 2451545.0;
 $4 = (+_slib_deg2rad($1));
 $5 = (+Math_sin((+$4)));
 $6 = $5 * 0.0053;
 $7 = $3 + $6;
 $8 = $2 * 2.0;
 $9 = (+_slib_deg2rad($8));
 $10 = (+Math_sin((+$9)));
 $11 = $10 * 0.0068999999999999999;
 $12 = $7 - $11;
 return (+$12);
}
function _slib_sun_decl($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (+_slib_deg2rad($0));
 $2 = (+Math_sin((+$1)));
 $3 = (+_slib_deg2rad(23.440000000000001));
 $4 = (+Math_sin((+$3)));
 $5 = $2 * $4;
 $6 = (+Math_asin((+$5)));
 $7 = (+_slib_rad2deg($6));
 return (+$7);
}
function _slib_corr_sunrise_hour_angle($0,$1,$2) {
 $0 = +$0;
 $1 = +$1;
 $2 = +$2;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (+Math_sqrt((+$2)));
 $4 = $3 * 2.0760000000000001;
 $5 = $4 / 60.0;
 $6 = 0.82999999999999996 - $5;
 $7 = (+_slib_deg2rad($6));
 $8 = (+Math_sin((+$7)));
 $9 = (+_slib_deg2rad($0));
 $10 = (+Math_sin((+$9)));
 $11 = (+_slib_deg2rad($1));
 $12 = (+Math_sin((+$11)));
 $13 = $10 * $12;
 $14 = $8 - $13;
 $15 = (+_slib_deg2rad($0));
 $16 = (+Math_cos((+$15)));
 $17 = (+_slib_deg2rad($1));
 $18 = (+Math_cos((+$17)));
 $19 = $16 * $18;
 $20 = $14 / $19;
 $21 = (+Math_acos((+$20)));
 $22 = (+_slib_rad2deg($21));
 return (+$22);
}
function _slib_eular($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$01011 = 0, $$012 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $exitcond = 0, $spec$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 if ($1) {
  $$0$lcssa = 0;
  return ($$0$lcssa|0);
 }
 $$01011 = 0;$$012 = 0;
 while(1) {
  $2 = (_slib_isrp($0,$$01011)|0);
  $3 = ($2|0)!=(0);
  $4 = $3&1;
  $spec$select = (($$012) + ($4))|0;
  $5 = (($$01011) + 1)|0;
  $exitcond = ($5|0)==($0|0);
  if ($exitcond) {
   $$0$lcssa = $spec$select;
   break;
  } else {
   $$01011 = $5;$$012 = $spec$select;
  }
 }
 return ($$0$lcssa|0);
}
function _slib_gcf($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa = 0, $$067 = 0, $$08 = 0, $$08$phi = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 if ($2) {
  $$0$lcssa = $0;
 } else {
  $$067 = $1;$$08 = $0;
  while(1) {
   $3 = (($$08>>>0) % ($$067>>>0))&-1;
   $4 = ($3|0)==(0);
   if ($4) {
    $$0$lcssa = $$067;
    break;
   } else {
    $$08$phi = $$067;$$067 = $3;$$08 = $$08$phi;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _slib_ispn($0) {
 $0 = $0|0;
 var $$014 = 0, $$015 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 & 1;
 $2 = ($1|0)==(0);
 $3 = ($0|0)!=(2);
 $or$cond = $3 & $2;
 $4 = ($0|0)==(1);
 $or$cond3 = $4 | $or$cond;
 if ($or$cond3) {
  $$014 = 0;
  return ($$014|0);
 }
 $5 = ($0>>>0)<(9);
 if ($5) {
  $$014 = 1;
  return ($$014|0);
 }
 $$015 = 3;
 while(1) {
  $9 = (($0>>>0) % ($$015>>>0))&-1;
  $10 = ($9|0)==(0);
  $7 = (($$015) + 1)|0;
  if ($10) {
   $$014 = 0;
   label = 6;
   break;
  }
  $6 = Math_imul($7, $7)|0;
  $8 = ($6>>>0)>($0>>>0);
  if ($8) {
   $$014 = 1;
   label = 6;
   break;
  } else {
   $$015 = $7;
  }
 }
 if ((label|0) == 6) {
  return ($$014|0);
 }
 return (0)|0;
}
function _slib_isrp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_slib_gcf($0,$1)|0);
 $3 = ($2|0)==(1);
 $4 = $3&1;
 return ($4|0);
}
function _slib_lcm($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = Math_imul($1, $0)|0;
 $3 = (_slib_gcf($0,$1)|0);
 $4 = (($2>>>0) / ($3>>>0))&-1;
 return ($4|0);
}
function _slib_factorial($0) {
 $0 = $0|0;
 var $$011 = 0, $$0810 = 0, $$09 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)<(2);
 if ($1) {
  $$09 = 1;
 } else {
  $2 = ($0|0)==(2);
  if ($2) {
   $$09 = 2;
  } else {
   $$011 = $0;$$0810 = $0;
   while(1) {
    $3 = (($$011) + -1)|0;
    $4 = Math_imul($3, $$0810)|0;
    $5 = ($3|0)==(2);
    if ($5) {
     $$09 = $4;
     break;
    } else {
     $$011 = $3;$$0810 = $4;
    }
   }
  }
 }
 return ($$09|0);
}
function _slib_permu($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$011$i = 0, $$01721 = 0, $$01820 = 0, $$0810$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) - ($1))|0;
 $3 = ($1|0)==(1);
 do {
  if ($3) {
   $$0 = $0;
  } else {
   $4 = ($0|0)==($1|0);
   if ($4) {
    $5 = ($0>>>0)<(2);
    if ($5) {
     $$0 = 1;
     break;
    }
    $6 = ($0|0)==(2);
    if ($6) {
     $$0 = 2;
     break;
    }
    $$011$i = $0;$$0810$i = $0;
    while(1) {
     $7 = (($$011$i) + -1)|0;
     $8 = Math_imul($7, $$0810$i)|0;
     $9 = ($7|0)==(2);
     if ($9) {
      $$0 = $8;
      break;
     } else {
      $$011$i = $7;$$0810$i = $8;
     }
    }
   } else {
    $10 = ($0>>>0)<($1>>>0);
    if ($10) {
     $$0 = 0;
     break;
    }
    $11 = ($2>>>0)<($0>>>0);
    if (!($11)) {
     $$0 = 1;
     break;
    }
    $$01721 = 1;$$01820 = $0;
    while(1) {
     $12 = (($$01820) + -1)|0;
     $13 = Math_imul($$01721, $$01820)|0;
     $14 = ($12>>>0)>($2>>>0);
     if ($14) {
      $$01721 = $13;$$01820 = $12;
     } else {
      $$0 = $13;
      break;
     }
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _slib_combi($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$0$i4 = 0, $$0$i6 = 0, $$011$i = 0, $$011$i$i = 0, $$01721$i = 0, $$01820$i = 0, $$0810$i = 0, $$0810$i$i = 0, $$09$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) - ($1))|0;
 $3 = ($1|0)==(1);
 do {
  if ($3) {
   $$0$i4 = $0;$$09$i = 1;
  } else {
   $4 = ($0|0)==($1|0);
   if ($4) {
    $5 = ($0>>>0)<(2);
    if ($5) {
     $$0$i = 1;
     label = 11;
    } else {
     $6 = ($0|0)==(2);
     if ($6) {
      $$0$i = 2;
      label = 11;
     } else {
      $$011$i$i = $0;$$0810$i$i = $0;
      while(1) {
       $7 = (($$011$i$i) + -1)|0;
       $8 = Math_imul($7, $$0810$i$i)|0;
       $9 = ($7|0)==(2);
       if ($9) {
        $$0$i = $8;
        label = 11;
        break;
       } else {
        $$011$i$i = $7;$$0810$i$i = $8;
       }
      }
     }
    }
   } else {
    $10 = ($0>>>0)<($1>>>0);
    if ($10) {
     $$0$i6 = 0;
    } else {
     $11 = ($2>>>0)<($0>>>0);
     if ($11) {
      $$01721$i = 1;$$01820$i = $0;
      while(1) {
       $12 = (($$01820$i) + -1)|0;
       $13 = Math_imul($$01820$i, $$01721$i)|0;
       $14 = ($12>>>0)>($2>>>0);
       if ($14) {
        $$01721$i = $13;$$01820$i = $12;
       } else {
        $$0$i = $13;
        label = 11;
        break;
       }
      }
     } else {
      $$0$i = 1;
      label = 11;
     }
    }
   }
   if ((label|0) == 11) {
    $15 = ($1>>>0)<(2);
    if ($15) {
     $$0$i4 = $$0$i;$$09$i = 1;
     break;
    } else {
     $$0$i6 = $$0$i;
    }
   }
   $16 = ($1|0)==(2);
   if ($16) {
    $$0$i4 = $$0$i6;$$09$i = 2;
   } else {
    $$011$i = $1;$$0810$i = $1;
    while(1) {
     $17 = (($$011$i) + -1)|0;
     $18 = Math_imul($17, $$0810$i)|0;
     $19 = ($17|0)==(2);
     if ($19) {
      $$0$i4 = $$0$i6;$$09$i = $18;
      break;
     } else {
      $$011$i = $17;$$0810$i = $18;
     }
    }
   }
  }
 } while(0);
 $20 = (($$0$i4>>>0) / ($$09$i>>>0))&-1;
 return ($20|0);
}
function _slib_pnlst($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$01011 = 0, $$012 = 0, $$1 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(0);
 if ($3) {
  return;
 }
 $$01011 = $0;$$012 = 0;
 while(1) {
  $4 = (_slib_ispn($$01011)|0);
  $5 = ($4|0)==(0);
  if ($5) {
   $$1 = $$012;
  } else {
   $6 = (($1) + ($$012<<2)|0);
   $7 = (($$012) + 1)|0;
   HEAP32[$6>>2] = $$01011;
   $$1 = $7;
  }
  $8 = (($$01011) + 1)|0;
  $9 = ($$1>>>0)<($2>>>0);
  if ($9) {
   $$01011 = $8;$$012 = $$1;
  } else {
   break;
  }
 }
 return;
}
function _slib_h2hms($0,$1,$2,$3) {
 $0 = +$0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0.0, $11 = 0.0, $4 = 0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (~~(($0)));
 $5 = (+($4|0));
 HEAPF64[$1>>3] = $5;
 $6 = $0 - $5;
 $7 = $6 * 60.0;
 $8 = (~~(($7)));
 $9 = (+($8|0));
 HEAPF64[$2>>3] = $9;
 $10 = $7 - $9;
 $11 = $10 * 60.0;
 HEAPF64[$3>>3] = $11;
 return;
}
function _slib_hms2h($0,$1,$2) {
 $0 = +$0;
 $1 = +$1;
 $2 = +$2;
 var $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 / 60.0;
 $4 = $3 + $0;
 $5 = $2 / 3600.0;
 $6 = $4 + $5;
 return (+$6);
}
function _slib_d2dn($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$028 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $spec$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (($0|0) % 400)&-1;
 $4 = ($3|0)==(0);
 if ($4) {
  $$0 = 29;
 } else {
  $5 = $0 & 3;
  $6 = ($5|0)!=(0);
  $7 = (($0|0) % 100)&-1;
  $8 = ($7|0)==(0);
  $or$cond = $6 | $8;
  $spec$select = $or$cond ? 28 : 29;
  $$0 = $spec$select;
 }
 do {
  switch ($1|0) {
  case 1:  {
   $$028 = $2;
   break;
  }
  case 2:  {
   $9 = (($2) + 31)|0;
   $$028 = $9;
   break;
  }
  case 3:  {
   $10 = (($$0) + ($2))|0;
   $11 = (($10) + 31)|0;
   $$028 = $11;
   break;
  }
  case 4:  {
   $12 = (($$0) + ($2))|0;
   $13 = (($12) + 62)|0;
   $$028 = $13;
   break;
  }
  case 5:  {
   $14 = (($$0) + ($2))|0;
   $15 = (($14) + 92)|0;
   $$028 = $15;
   break;
  }
  case 6:  {
   $16 = (($$0) + ($2))|0;
   $17 = (($16) + 123)|0;
   $$028 = $17;
   break;
  }
  case 7:  {
   $18 = (($$0) + ($2))|0;
   $19 = (($18) + 153)|0;
   $$028 = $19;
   break;
  }
  case 8:  {
   $20 = (($$0) + ($2))|0;
   $21 = (($20) + 184)|0;
   $$028 = $21;
   break;
  }
  case 9:  {
   $22 = (($$0) + ($2))|0;
   $23 = (($22) + 215)|0;
   $$028 = $23;
   break;
  }
  case 10:  {
   $24 = (($$0) + ($2))|0;
   $25 = (($24) + 245)|0;
   $$028 = $25;
   break;
  }
  case 11:  {
   $26 = (($$0) + ($2))|0;
   $27 = (($26) + 276)|0;
   $$028 = $27;
   break;
  }
  case 12:  {
   $28 = (($$0) + ($2))|0;
   $29 = (($28) + 306)|0;
   $$028 = $29;
   break;
  }
  default: {
   $$028 = -1;
  }
  }
 } while(0);
 return ($$028|0);
}
function _slib_tm2jd($0) {
 $0 = $0|0;
 var $$0 = 0.0, $$neg = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0, $43 = 0.0;
 var $44 = 0.0, $45 = 0.0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 12|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) + -13)|0;
 $8 = (($7|0) / 12)&-1;
 $9 = (($8) + ($2))|0;
 $10 = ($9*1461)|0;
 $11 = (($10) + 9788700)|0;
 $12 = (($11|0) / 4)&-1;
 $13 = (($4) + -1)|0;
 $14 = Math_imul($8, -12)|0;
 $15 = (($13) + ($14))|0;
 $16 = ($15*367)|0;
 $17 = (($16|0) / 12)&-1;
 $18 = (($9) + 6800)|0;
 $19 = (($18|0) / 100)&-1;
 $20 = ($19*3)|0;
 $$neg = (($20|0) / -4)&-1;
 $21 = (($6) + -32075)|0;
 $22 = (($21) + ($12))|0;
 $23 = (($22) + ($$neg))|0;
 $24 = (($23) + ($17))|0;
 $25 = (+($24|0));
 $26 = ($2|0)<(-6613);
 if ($26) {
  $$0 = -1.0;
  return (+$$0);
 }
 $27 = ($2|0)==(-6613);
 $28 = ($4|0)<(10);
 $or$cond = $27 & $28;
 if ($or$cond) {
  $$0 = -1.0;
  return (+$$0);
 }
 $29 = ($4|0)==(10);
 $or$cond3 = $27 & $29;
 $30 = ($6|0)<(24);
 $or$cond5 = $or$cond3 & $30;
 if ($or$cond5) {
  $$0 = -1.0;
  return (+$$0);
 }
 $31 = ((($0)) + 8|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = (+($32|0));
 $34 = $33 + -12.0;
 $35 = $34 / 24.0;
 $36 = $35 + $25;
 $37 = ((($0)) + 4|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = (+($38|0));
 $40 = $39 / 1440.0;
 $41 = $40 + $36;
 $42 = HEAP32[$0>>2]|0;
 $43 = (+($42|0));
 $44 = $43 / 86400.0;
 $45 = $44 + $41;
 $$0 = $45;
 return (+$$0);
}
function _slib_jd2tm($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$0$v = 0.0, $$pn = 0.0, $10 = 0.0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0.0, $43 = 0;
 var $44 = 0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0.0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0.0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = sp + 16|0;
 $3 = sp + 8|0;
 $4 = sp;
 $5 = (+_llvm_round_f64((+$0)));
 $6 = (~~(($5)));
 $7 = (+($6|0));
 $8 = $7 < $0;
 $9 = $0 + 1.0;
 $$pn = $8 ? $0 : $9;
 $10 = $$pn - $7;
 $11 = (($6) + 1401)|0;
 $12 = $6 << 2;
 $13 = (($12) + 274277)|0;
 $14 = (($13|0) / 146097)&-1;
 $15 = ($14*3)|0;
 $16 = (($15|0) / 4)&-1;
 $17 = (($11) + ($16))|0;
 $18 = $17 << 2;
 $19 = (($18) + -149)|0;
 $20 = (($19|0) / 1461)&-1;
 $21 = ($20*1461)|0;
 $22 = (($19) - ($21))|0;
 $23 = (($22|0) / 4)&-1;
 $24 = ($23*5)|0;
 $25 = (($24) + 2)|0;
 $26 = (($25|0) / 153)&-1;
 $27 = ($26*153)|0;
 $28 = (($25) - ($27))|0;
 $29 = (($28|0) / 5)&-1;
 $30 = (($29) + 1)|0;
 $31 = (($26) + 2)|0;
 $32 = (($31|0) % 12)&-1;
 $33 = (($32) + 1)|0;
 $34 = (($20) + -4716)|0;
 $35 = (13 - ($32))|0;
 $36 = (($35|0) / 12)&-1;
 $37 = (($34) + ($36))|0;
 $38 = !($10 >= 0.5);
 $$0$v = $38 ? 0.5 : -0.5;
 $$0 = $10 + $$0$v;
 $39 = $$0 * 24.0;
 _slib_h2hms($39,$2,$3,$4);
 $40 = +HEAPF64[$4>>3];
 $41 = (~~(($40)));
 HEAP32[$1>>2] = $41;
 $42 = +HEAPF64[$3>>3];
 $43 = (~~(($42)));
 $44 = ((($1)) + 4|0);
 HEAP32[$44>>2] = $43;
 $45 = +HEAPF64[$2>>3];
 $46 = (~~(($45)));
 $47 = ((($1)) + 8|0);
 HEAP32[$47>>2] = $46;
 $48 = ((($1)) + 12|0);
 HEAP32[$48>>2] = $30;
 $49 = ((($1)) + 16|0);
 HEAP32[$49>>2] = $32;
 $50 = (($37) + -1900)|0;
 $51 = ((($1)) + 20|0);
 HEAP32[$51>>2] = $50;
 $52 = (($6) + 1)|0;
 $53 = (($52|0) % 7)&-1;
 $54 = ((($1)) + 24|0);
 HEAP32[$54>>2] = $53;
 $55 = (_slib_d2dn($37,$33,$30)|0);
 $56 = (($55) + -1)|0;
 $57 = ((($1)) + 28|0);
 HEAP32[$57>>2] = $56;
 $58 = ((($1)) + 32|0);
 HEAP32[$58>>2] = -1;
 STACKTOP = sp;return;
}
function _malloc($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i16$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$02065$i$i = 0, $$0207$lcssa$i$i = 0, $$02074$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0, $$024372$i = 0, $$0286$i$i = 0, $$028711$i$i = 0, $$0288$lcssa$i$i = 0, $$028810$i$i = 0;
 var $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$034217$i = 0, $$0343$lcssa$i = 0, $$034316$i = 0, $$0345$i = 0, $$0351$i = 0, $$0357$i = 0, $$0358$i = 0, $$0360$i = 0, $$0361$i = 0, $$0367$i = 0, $$1194$i = 0, $$1194$i$be = 0, $$1194$i$ph = 0, $$1196$i = 0, $$1196$i$be = 0, $$1196$i$ph = 0, $$124471$i = 0;
 var $$1290$i$i = 0, $$1290$i$i$be = 0, $$1290$i$i$ph = 0, $$1292$i$i = 0, $$1292$i$i$be = 0, $$1292$i$i$ph = 0, $$1341$i = 0, $$1346$i = 0, $$1362$i = 0, $$1369$i = 0, $$1369$i$be = 0, $$1369$i$ph = 0, $$1373$i = 0, $$1373$i$be = 0, $$1373$i$ph = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0;
 var $$3$i$i = 0, $$3$i203 = 0, $$3$i203218 = 0, $$3348$i = 0, $$3371$i = 0, $$4$lcssa$i = 0, $$420$i = 0, $$420$i$ph = 0, $$4236$i = 0, $$4349$lcssa$i = 0, $$434919$i = 0, $$434919$i$ph = 0, $$4355$i = 0, $$535618$i = 0, $$535618$i$ph = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0;
 var $$pre$i17$i = 0, $$pre$i208 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i209Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi17$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre16$i$i = 0, $$sink = 0, $$sink325 = 0, $$sink326 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0;
 var $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0;
 var $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0;
 var $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0;
 var $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
 var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
 var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
 var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
 var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
 var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
 var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
 var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
 var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
 var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0;
 var $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0;
 var $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i207 = 0, $not$$i = 0, $or$cond$i = 0, $or$cond$i213 = 0, $or$cond1$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond2$i214 = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond6$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $or$cond8$not$i = 0;
 var $spec$select$i = 0, $spec$select$i205 = 0, $spec$select1$i = 0, $spec$select3$i = 0, $spec$select49$i = 0, $spec$select7$i = 0, $spec$select9$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[296]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (1224 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[296] = $24;
     } else {
      $25 = HEAP32[(1200)>>2]|0;
      $26 = ($25>>>0)>($20>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(1192)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (1224 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($73|0)==($69|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[296] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(1200)>>2]|0;
       $79 = ($78>>>0)>($73>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($71) + ($83)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(1204)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (1224 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[296] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(1200)>>2]|0;
       $104 = ($103>>>0)>($102>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(1192)>>2] = $84;
     HEAP32[(1204)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(1188)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (1488 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $$0189$i = $134;$$0190$i = $134;$$0191$i = $138;
     while(1) {
      $139 = ((($$0189$i)) + 16|0);
      $140 = HEAP32[$139>>2]|0;
      $141 = ($140|0)==(0|0);
      if ($141) {
       $142 = ((($$0189$i)) + 20|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        break;
       } else {
        $146 = $143;
       }
      } else {
       $146 = $140;
      }
      $145 = ((($146)) + 4|0);
      $147 = HEAP32[$145>>2]|0;
      $148 = $147 & -8;
      $149 = (($148) - ($6))|0;
      $150 = ($149>>>0)<($$0191$i>>>0);
      $spec$select$i = $150 ? $149 : $$0191$i;
      $spec$select1$i = $150 ? $146 : $$0190$i;
      $$0189$i = $146;$$0190$i = $spec$select1$i;$$0191$i = $spec$select$i;
     }
     $151 = HEAP32[(1200)>>2]|0;
     $152 = ($151>>>0)>($$0190$i>>>0);
     if ($152) {
      _abort();
      // unreachable;
     }
     $153 = (($$0190$i) + ($6)|0);
     $154 = ($153>>>0)>($$0190$i>>>0);
     if (!($154)) {
      _abort();
      // unreachable;
     }
     $155 = ((($$0190$i)) + 24|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ((($$0190$i)) + 12|0);
     $158 = HEAP32[$157>>2]|0;
     $159 = ($158|0)==($$0190$i|0);
     do {
      if ($159) {
       $169 = ((($$0190$i)) + 20|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==(0|0);
       if ($171) {
        $172 = ((($$0190$i)) + 16|0);
        $173 = HEAP32[$172>>2]|0;
        $174 = ($173|0)==(0|0);
        if ($174) {
         $$3$i = 0;
         break;
        } else {
         $$1194$i$ph = $173;$$1196$i$ph = $172;
        }
       } else {
        $$1194$i$ph = $170;$$1196$i$ph = $169;
       }
       $$1194$i = $$1194$i$ph;$$1196$i = $$1196$i$ph;
       while(1) {
        $175 = ((($$1194$i)) + 20|0);
        $176 = HEAP32[$175>>2]|0;
        $177 = ($176|0)==(0|0);
        if ($177) {
         $178 = ((($$1194$i)) + 16|0);
         $179 = HEAP32[$178>>2]|0;
         $180 = ($179|0)==(0|0);
         if ($180) {
          break;
         } else {
          $$1194$i$be = $179;$$1196$i$be = $178;
         }
        } else {
         $$1194$i$be = $176;$$1196$i$be = $175;
        }
        $$1194$i = $$1194$i$be;$$1196$i = $$1196$i$be;
       }
       $181 = ($151>>>0)>($$1196$i>>>0);
       if ($181) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1196$i>>2] = 0;
        $$3$i = $$1194$i;
        break;
       }
      } else {
       $160 = ((($$0190$i)) + 8|0);
       $161 = HEAP32[$160>>2]|0;
       $162 = ($151>>>0)>($161>>>0);
       if ($162) {
        _abort();
        // unreachable;
       }
       $163 = ((($161)) + 12|0);
       $164 = HEAP32[$163>>2]|0;
       $165 = ($164|0)==($$0190$i|0);
       if (!($165)) {
        _abort();
        // unreachable;
       }
       $166 = ((($158)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($167|0)==($$0190$i|0);
       if ($168) {
        HEAP32[$163>>2] = $158;
        HEAP32[$166>>2] = $161;
        $$3$i = $158;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $182 = ($156|0)==(0|0);
     L78: do {
      if (!($182)) {
       $183 = ((($$0190$i)) + 28|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = (1488 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       do {
        if ($187) {
         HEAP32[$185>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $188 = 1 << $184;
          $189 = $188 ^ -1;
          $190 = $108 & $189;
          HEAP32[(1188)>>2] = $190;
          break L78;
         }
        } else {
         $191 = HEAP32[(1200)>>2]|0;
         $192 = ($191>>>0)>($156>>>0);
         if ($192) {
          _abort();
          // unreachable;
         } else {
          $193 = ((($156)) + 16|0);
          $194 = HEAP32[$193>>2]|0;
          $195 = ($194|0)==($$0190$i|0);
          $196 = ((($156)) + 20|0);
          $$sink = $195 ? $193 : $196;
          HEAP32[$$sink>>2] = $$3$i;
          $197 = ($$3$i|0)==(0|0);
          if ($197) {
           break L78;
          } else {
           break;
          }
         }
        }
       } while(0);
       $198 = HEAP32[(1200)>>2]|0;
       $199 = ($198>>>0)>($$3$i>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($$3$i)) + 24|0);
       HEAP32[$200>>2] = $156;
       $201 = ((($$0190$i)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($198>>>0)>($202>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($$0190$i)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(1200)>>2]|0;
        $211 = ($210>>>0)>($208>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($$0191$i>>>0)<(16);
     if ($214) {
      $215 = (($$0191$i) + ($6))|0;
      $216 = $215 | 3;
      $217 = ((($$0190$i)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($$0190$i) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $6 | 3;
      $223 = ((($$0190$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $$0191$i | 1;
      $225 = ((($153)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($153) + ($$0191$i)|0);
      HEAP32[$226>>2] = $$0191$i;
      $227 = ($37|0)==(0);
      if (!($227)) {
       $228 = HEAP32[(1204)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (1224 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $232 & $8;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $232 | $8;
        HEAP32[296] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(1200)>>2]|0;
        $239 = ($238>>>0)>($237>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$0187$i = $237;$$pre$phi$iZ2D = $236;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $240 = ((($$0187$i)) + 12|0);
       HEAP32[$240>>2] = $228;
       $241 = ((($228)) + 8|0);
       HEAP32[$241>>2] = $$0187$i;
       $242 = ((($228)) + 12|0);
       HEAP32[$242>>2] = $231;
      }
      HEAP32[(1192)>>2] = $$0191$i;
      HEAP32[(1204)>>2] = $153;
     }
     $243 = ((($$0190$i)) + 8|0);
     $$0 = $243;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $244 = ($0>>>0)>(4294967231);
   if ($244) {
    $$0197 = -1;
   } else {
    $245 = (($0) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(1188)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $$0197 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $$0357$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $$0357$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $$0357$i = $274;
      }
     }
     $275 = (1488 + ($$0357$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L122: do {
      if ($277) {
       $$2353$i = 0;$$3$i203 = 0;$$3348$i = $249;
       label = 85;
      } else {
       $278 = ($$0357$i|0)==(31);
       $279 = $$0357$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $$0340$i = 0;$$0345$i = $249;$$0351$i = $276;$$0358$i = $282;$$0361$i = 0;
       while(1) {
        $283 = ((($$0351$i)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($$0345$i>>>0);
        if ($287) {
         $288 = ($286|0)==(0);
         if ($288) {
          $$420$i$ph = $$0351$i;$$434919$i$ph = 0;$$535618$i$ph = $$0351$i;
          label = 89;
          break L122;
         } else {
          $$1341$i = $$0351$i;$$1346$i = $286;
         }
        } else {
         $$1341$i = $$0340$i;$$1346$i = $$0345$i;
        }
        $289 = ((($$0351$i)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $$0358$i >>> 31;
        $292 = (((($$0351$i)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond2$i = $294 | $295;
        $$1362$i = $or$cond2$i ? $$0361$i : $290;
        $296 = ($293|0)==(0|0);
        $spec$select7$i = $$0358$i << 1;
        if ($296) {
         $$2353$i = $$1362$i;$$3$i203 = $$1341$i;$$3348$i = $$1346$i;
         label = 85;
         break;
        } else {
         $$0340$i = $$1341$i;$$0345$i = $$1346$i;$$0351$i = $293;$$0358$i = $spec$select7$i;$$0361$i = $$1362$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 85) {
      $297 = ($$2353$i|0)==(0|0);
      $298 = ($$3$i203|0)==(0|0);
      $or$cond$i = $297 & $298;
      if ($or$cond$i) {
       $299 = 2 << $$0357$i;
       $300 = (0 - ($299))|0;
       $301 = $299 | $300;
       $302 = $301 & $247;
       $303 = ($302|0)==(0);
       if ($303) {
        $$0197 = $246;
        break;
       }
       $304 = (0 - ($302))|0;
       $305 = $302 & $304;
       $306 = (($305) + -1)|0;
       $307 = $306 >>> 12;
       $308 = $307 & 16;
       $309 = $306 >>> $308;
       $310 = $309 >>> 5;
       $311 = $310 & 8;
       $312 = $311 | $308;
       $313 = $309 >>> $311;
       $314 = $313 >>> 2;
       $315 = $314 & 4;
       $316 = $312 | $315;
       $317 = $313 >>> $315;
       $318 = $317 >>> 1;
       $319 = $318 & 2;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 1;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = (($324) + ($325))|0;
       $327 = (1488 + ($326<<2)|0);
       $328 = HEAP32[$327>>2]|0;
       $$3$i203218 = 0;$$4355$i = $328;
      } else {
       $$3$i203218 = $$3$i203;$$4355$i = $$2353$i;
      }
      $329 = ($$4355$i|0)==(0|0);
      if ($329) {
       $$4$lcssa$i = $$3$i203218;$$4349$lcssa$i = $$3348$i;
      } else {
       $$420$i$ph = $$3$i203218;$$434919$i$ph = $$3348$i;$$535618$i$ph = $$4355$i;
       label = 89;
      }
     }
     if ((label|0) == 89) {
      $$420$i = $$420$i$ph;$$434919$i = $$434919$i$ph;$$535618$i = $$535618$i$ph;
      while(1) {
       $330 = ((($$535618$i)) + 4|0);
       $331 = HEAP32[$330>>2]|0;
       $332 = $331 & -8;
       $333 = (($332) - ($246))|0;
       $334 = ($333>>>0)<($$434919$i>>>0);
       $spec$select$i205 = $334 ? $333 : $$434919$i;
       $spec$select3$i = $334 ? $$535618$i : $$420$i;
       $335 = ((($$535618$i)) + 16|0);
       $336 = HEAP32[$335>>2]|0;
       $337 = ($336|0)==(0|0);
       if ($337) {
        $338 = ((($$535618$i)) + 20|0);
        $339 = HEAP32[$338>>2]|0;
        $341 = $339;
       } else {
        $341 = $336;
       }
       $340 = ($341|0)==(0|0);
       if ($340) {
        $$4$lcssa$i = $spec$select3$i;$$4349$lcssa$i = $spec$select$i205;
        break;
       } else {
        $$420$i = $spec$select3$i;$$434919$i = $spec$select$i205;$$535618$i = $341;
       }
      }
     }
     $342 = ($$4$lcssa$i|0)==(0|0);
     if ($342) {
      $$0197 = $246;
     } else {
      $343 = HEAP32[(1192)>>2]|0;
      $344 = (($343) - ($246))|0;
      $345 = ($$4349$lcssa$i>>>0)<($344>>>0);
      if ($345) {
       $346 = HEAP32[(1200)>>2]|0;
       $347 = ($346>>>0)>($$4$lcssa$i>>>0);
       if ($347) {
        _abort();
        // unreachable;
       }
       $348 = (($$4$lcssa$i) + ($246)|0);
       $349 = ($348>>>0)>($$4$lcssa$i>>>0);
       if (!($349)) {
        _abort();
        // unreachable;
       }
       $350 = ((($$4$lcssa$i)) + 24|0);
       $351 = HEAP32[$350>>2]|0;
       $352 = ((($$4$lcssa$i)) + 12|0);
       $353 = HEAP32[$352>>2]|0;
       $354 = ($353|0)==($$4$lcssa$i|0);
       do {
        if ($354) {
         $364 = ((($$4$lcssa$i)) + 20|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==(0|0);
         if ($366) {
          $367 = ((($$4$lcssa$i)) + 16|0);
          $368 = HEAP32[$367>>2]|0;
          $369 = ($368|0)==(0|0);
          if ($369) {
           $$3371$i = 0;
           break;
          } else {
           $$1369$i$ph = $368;$$1373$i$ph = $367;
          }
         } else {
          $$1369$i$ph = $365;$$1373$i$ph = $364;
         }
         $$1369$i = $$1369$i$ph;$$1373$i = $$1373$i$ph;
         while(1) {
          $370 = ((($$1369$i)) + 20|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if ($372) {
           $373 = ((($$1369$i)) + 16|0);
           $374 = HEAP32[$373>>2]|0;
           $375 = ($374|0)==(0|0);
           if ($375) {
            break;
           } else {
            $$1369$i$be = $374;$$1373$i$be = $373;
           }
          } else {
           $$1369$i$be = $371;$$1373$i$be = $370;
          }
          $$1369$i = $$1369$i$be;$$1373$i = $$1373$i$be;
         }
         $376 = ($346>>>0)>($$1373$i>>>0);
         if ($376) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1373$i>>2] = 0;
          $$3371$i = $$1369$i;
          break;
         }
        } else {
         $355 = ((($$4$lcssa$i)) + 8|0);
         $356 = HEAP32[$355>>2]|0;
         $357 = ($346>>>0)>($356>>>0);
         if ($357) {
          _abort();
          // unreachable;
         }
         $358 = ((($356)) + 12|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==($$4$lcssa$i|0);
         if (!($360)) {
          _abort();
          // unreachable;
         }
         $361 = ((($353)) + 8|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($$4$lcssa$i|0);
         if ($363) {
          HEAP32[$358>>2] = $353;
          HEAP32[$361>>2] = $356;
          $$3371$i = $353;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $377 = ($351|0)==(0|0);
       L176: do {
        if ($377) {
         $469 = $247;
        } else {
         $378 = ((($$4$lcssa$i)) + 28|0);
         $379 = HEAP32[$378>>2]|0;
         $380 = (1488 + ($379<<2)|0);
         $381 = HEAP32[$380>>2]|0;
         $382 = ($$4$lcssa$i|0)==($381|0);
         do {
          if ($382) {
           HEAP32[$380>>2] = $$3371$i;
           $cond$i207 = ($$3371$i|0)==(0|0);
           if ($cond$i207) {
            $383 = 1 << $379;
            $384 = $383 ^ -1;
            $385 = $247 & $384;
            HEAP32[(1188)>>2] = $385;
            $469 = $385;
            break L176;
           }
          } else {
           $386 = HEAP32[(1200)>>2]|0;
           $387 = ($386>>>0)>($351>>>0);
           if ($387) {
            _abort();
            // unreachable;
           } else {
            $388 = ((($351)) + 16|0);
            $389 = HEAP32[$388>>2]|0;
            $390 = ($389|0)==($$4$lcssa$i|0);
            $391 = ((($351)) + 20|0);
            $$sink325 = $390 ? $388 : $391;
            HEAP32[$$sink325>>2] = $$3371$i;
            $392 = ($$3371$i|0)==(0|0);
            if ($392) {
             $469 = $247;
             break L176;
            } else {
             break;
            }
           }
          }
         } while(0);
         $393 = HEAP32[(1200)>>2]|0;
         $394 = ($393>>>0)>($$3371$i>>>0);
         if ($394) {
          _abort();
          // unreachable;
         }
         $395 = ((($$3371$i)) + 24|0);
         HEAP32[$395>>2] = $351;
         $396 = ((($$4$lcssa$i)) + 16|0);
         $397 = HEAP32[$396>>2]|0;
         $398 = ($397|0)==(0|0);
         do {
          if (!($398)) {
           $399 = ($393>>>0)>($397>>>0);
           if ($399) {
            _abort();
            // unreachable;
           } else {
            $400 = ((($$3371$i)) + 16|0);
            HEAP32[$400>>2] = $397;
            $401 = ((($397)) + 24|0);
            HEAP32[$401>>2] = $$3371$i;
            break;
           }
          }
         } while(0);
         $402 = ((($$4$lcssa$i)) + 20|0);
         $403 = HEAP32[$402>>2]|0;
         $404 = ($403|0)==(0|0);
         if ($404) {
          $469 = $247;
         } else {
          $405 = HEAP32[(1200)>>2]|0;
          $406 = ($405>>>0)>($403>>>0);
          if ($406) {
           _abort();
           // unreachable;
          } else {
           $407 = ((($$3371$i)) + 20|0);
           HEAP32[$407>>2] = $403;
           $408 = ((($403)) + 24|0);
           HEAP32[$408>>2] = $$3371$i;
           $469 = $247;
           break;
          }
         }
        }
       } while(0);
       $409 = ($$4349$lcssa$i>>>0)<(16);
       L200: do {
        if ($409) {
         $410 = (($$4349$lcssa$i) + ($246))|0;
         $411 = $410 | 3;
         $412 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$412>>2] = $411;
         $413 = (($$4$lcssa$i) + ($410)|0);
         $414 = ((($413)) + 4|0);
         $415 = HEAP32[$414>>2]|0;
         $416 = $415 | 1;
         HEAP32[$414>>2] = $416;
        } else {
         $417 = $246 | 3;
         $418 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$418>>2] = $417;
         $419 = $$4349$lcssa$i | 1;
         $420 = ((($348)) + 4|0);
         HEAP32[$420>>2] = $419;
         $421 = (($348) + ($$4349$lcssa$i)|0);
         HEAP32[$421>>2] = $$4349$lcssa$i;
         $422 = $$4349$lcssa$i >>> 3;
         $423 = ($$4349$lcssa$i>>>0)<(256);
         if ($423) {
          $424 = $422 << 1;
          $425 = (1224 + ($424<<2)|0);
          $426 = HEAP32[296]|0;
          $427 = 1 << $422;
          $428 = $426 & $427;
          $429 = ($428|0)==(0);
          if ($429) {
           $430 = $426 | $427;
           HEAP32[296] = $430;
           $$pre$i208 = ((($425)) + 8|0);
           $$0367$i = $425;$$pre$phi$i209Z2D = $$pre$i208;
          } else {
           $431 = ((($425)) + 8|0);
           $432 = HEAP32[$431>>2]|0;
           $433 = HEAP32[(1200)>>2]|0;
           $434 = ($433>>>0)>($432>>>0);
           if ($434) {
            _abort();
            // unreachable;
           } else {
            $$0367$i = $432;$$pre$phi$i209Z2D = $431;
           }
          }
          HEAP32[$$pre$phi$i209Z2D>>2] = $348;
          $435 = ((($$0367$i)) + 12|0);
          HEAP32[$435>>2] = $348;
          $436 = ((($348)) + 8|0);
          HEAP32[$436>>2] = $$0367$i;
          $437 = ((($348)) + 12|0);
          HEAP32[$437>>2] = $425;
          break;
         }
         $438 = $$4349$lcssa$i >>> 8;
         $439 = ($438|0)==(0);
         if ($439) {
          $$0360$i = 0;
         } else {
          $440 = ($$4349$lcssa$i>>>0)>(16777215);
          if ($440) {
           $$0360$i = 31;
          } else {
           $441 = (($438) + 1048320)|0;
           $442 = $441 >>> 16;
           $443 = $442 & 8;
           $444 = $438 << $443;
           $445 = (($444) + 520192)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 4;
           $448 = $447 | $443;
           $449 = $444 << $447;
           $450 = (($449) + 245760)|0;
           $451 = $450 >>> 16;
           $452 = $451 & 2;
           $453 = $448 | $452;
           $454 = (14 - ($453))|0;
           $455 = $449 << $452;
           $456 = $455 >>> 15;
           $457 = (($454) + ($456))|0;
           $458 = $457 << 1;
           $459 = (($457) + 7)|0;
           $460 = $$4349$lcssa$i >>> $459;
           $461 = $460 & 1;
           $462 = $461 | $458;
           $$0360$i = $462;
          }
         }
         $463 = (1488 + ($$0360$i<<2)|0);
         $464 = ((($348)) + 28|0);
         HEAP32[$464>>2] = $$0360$i;
         $465 = ((($348)) + 16|0);
         $466 = ((($465)) + 4|0);
         HEAP32[$466>>2] = 0;
         HEAP32[$465>>2] = 0;
         $467 = 1 << $$0360$i;
         $468 = $469 & $467;
         $470 = ($468|0)==(0);
         if ($470) {
          $471 = $469 | $467;
          HEAP32[(1188)>>2] = $471;
          HEAP32[$463>>2] = $348;
          $472 = ((($348)) + 24|0);
          HEAP32[$472>>2] = $463;
          $473 = ((($348)) + 12|0);
          HEAP32[$473>>2] = $348;
          $474 = ((($348)) + 8|0);
          HEAP32[$474>>2] = $348;
          break;
         }
         $475 = HEAP32[$463>>2]|0;
         $476 = ((($475)) + 4|0);
         $477 = HEAP32[$476>>2]|0;
         $478 = $477 & -8;
         $479 = ($478|0)==($$4349$lcssa$i|0);
         L218: do {
          if ($479) {
           $$0343$lcssa$i = $475;
          } else {
           $480 = ($$0360$i|0)==(31);
           $481 = $$0360$i >>> 1;
           $482 = (25 - ($481))|0;
           $483 = $480 ? 0 : $482;
           $484 = $$4349$lcssa$i << $483;
           $$034217$i = $484;$$034316$i = $475;
           while(1) {
            $491 = $$034217$i >>> 31;
            $492 = (((($$034316$i)) + 16|0) + ($491<<2)|0);
            $487 = HEAP32[$492>>2]|0;
            $493 = ($487|0)==(0|0);
            if ($493) {
             break;
            }
            $485 = $$034217$i << 1;
            $486 = ((($487)) + 4|0);
            $488 = HEAP32[$486>>2]|0;
            $489 = $488 & -8;
            $490 = ($489|0)==($$4349$lcssa$i|0);
            if ($490) {
             $$0343$lcssa$i = $487;
             break L218;
            } else {
             $$034217$i = $485;$$034316$i = $487;
            }
           }
           $494 = HEAP32[(1200)>>2]|0;
           $495 = ($494>>>0)>($492>>>0);
           if ($495) {
            _abort();
            // unreachable;
           } else {
            HEAP32[$492>>2] = $348;
            $496 = ((($348)) + 24|0);
            HEAP32[$496>>2] = $$034316$i;
            $497 = ((($348)) + 12|0);
            HEAP32[$497>>2] = $348;
            $498 = ((($348)) + 8|0);
            HEAP32[$498>>2] = $348;
            break L200;
           }
          }
         } while(0);
         $499 = ((($$0343$lcssa$i)) + 8|0);
         $500 = HEAP32[$499>>2]|0;
         $501 = HEAP32[(1200)>>2]|0;
         $502 = ($501>>>0)<=($$0343$lcssa$i>>>0);
         $503 = ($501>>>0)<=($500>>>0);
         $504 = $503 & $502;
         if ($504) {
          $505 = ((($500)) + 12|0);
          HEAP32[$505>>2] = $348;
          HEAP32[$499>>2] = $348;
          $506 = ((($348)) + 8|0);
          HEAP32[$506>>2] = $500;
          $507 = ((($348)) + 12|0);
          HEAP32[$507>>2] = $$0343$lcssa$i;
          $508 = ((($348)) + 24|0);
          HEAP32[$508>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $509 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $509;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $510 = HEAP32[(1192)>>2]|0;
 $511 = ($510>>>0)<($$0197>>>0);
 if (!($511)) {
  $512 = (($510) - ($$0197))|0;
  $513 = HEAP32[(1204)>>2]|0;
  $514 = ($512>>>0)>(15);
  if ($514) {
   $515 = (($513) + ($$0197)|0);
   HEAP32[(1204)>>2] = $515;
   HEAP32[(1192)>>2] = $512;
   $516 = $512 | 1;
   $517 = ((($515)) + 4|0);
   HEAP32[$517>>2] = $516;
   $518 = (($513) + ($510)|0);
   HEAP32[$518>>2] = $512;
   $519 = $$0197 | 3;
   $520 = ((($513)) + 4|0);
   HEAP32[$520>>2] = $519;
  } else {
   HEAP32[(1192)>>2] = 0;
   HEAP32[(1204)>>2] = 0;
   $521 = $510 | 3;
   $522 = ((($513)) + 4|0);
   HEAP32[$522>>2] = $521;
   $523 = (($513) + ($510)|0);
   $524 = ((($523)) + 4|0);
   $525 = HEAP32[$524>>2]|0;
   $526 = $525 | 1;
   HEAP32[$524>>2] = $526;
  }
  $527 = ((($513)) + 8|0);
  $$0 = $527;
  STACKTOP = sp;return ($$0|0);
 }
 $528 = HEAP32[(1196)>>2]|0;
 $529 = ($528>>>0)>($$0197>>>0);
 if ($529) {
  $530 = (($528) - ($$0197))|0;
  HEAP32[(1196)>>2] = $530;
  $531 = HEAP32[(1208)>>2]|0;
  $532 = (($531) + ($$0197)|0);
  HEAP32[(1208)>>2] = $532;
  $533 = $530 | 1;
  $534 = ((($532)) + 4|0);
  HEAP32[$534>>2] = $533;
  $535 = $$0197 | 3;
  $536 = ((($531)) + 4|0);
  HEAP32[$536>>2] = $535;
  $537 = ((($531)) + 8|0);
  $$0 = $537;
  STACKTOP = sp;return ($$0|0);
 }
 $538 = HEAP32[414]|0;
 $539 = ($538|0)==(0);
 if ($539) {
  HEAP32[(1664)>>2] = 4096;
  HEAP32[(1660)>>2] = 4096;
  HEAP32[(1668)>>2] = -1;
  HEAP32[(1672)>>2] = -1;
  HEAP32[(1676)>>2] = 0;
  HEAP32[(1628)>>2] = 0;
  $540 = $1;
  $541 = $540 & -16;
  $542 = $541 ^ 1431655768;
  HEAP32[414] = $542;
  $546 = 4096;
 } else {
  $$pre$i210 = HEAP32[(1664)>>2]|0;
  $546 = $$pre$i210;
 }
 $543 = (($$0197) + 48)|0;
 $544 = (($$0197) + 47)|0;
 $545 = (($546) + ($544))|0;
 $547 = (0 - ($546))|0;
 $548 = $545 & $547;
 $549 = ($548>>>0)>($$0197>>>0);
 if (!($549)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $550 = HEAP32[(1624)>>2]|0;
 $551 = ($550|0)==(0);
 if (!($551)) {
  $552 = HEAP32[(1616)>>2]|0;
  $553 = (($552) + ($548))|0;
  $554 = ($553>>>0)<=($552>>>0);
  $555 = ($553>>>0)>($550>>>0);
  $or$cond1$i = $554 | $555;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $556 = HEAP32[(1628)>>2]|0;
 $557 = $556 & 4;
 $558 = ($557|0)==(0);
 L257: do {
  if ($558) {
   $559 = HEAP32[(1208)>>2]|0;
   $560 = ($559|0)==(0|0);
   L259: do {
    if ($560) {
     label = 173;
    } else {
     $$0$i$i = (1632);
     while(1) {
      $561 = HEAP32[$$0$i$i>>2]|0;
      $562 = ($561>>>0)>($559>>>0);
      if (!($562)) {
       $563 = ((($$0$i$i)) + 4|0);
       $564 = HEAP32[$563>>2]|0;
       $565 = (($561) + ($564)|0);
       $566 = ($565>>>0)>($559>>>0);
       if ($566) {
        break;
       }
      }
      $567 = ((($$0$i$i)) + 8|0);
      $568 = HEAP32[$567>>2]|0;
      $569 = ($568|0)==(0|0);
      if ($569) {
       label = 173;
       break L259;
      } else {
       $$0$i$i = $568;
      }
     }
     $592 = (($545) - ($528))|0;
     $593 = $592 & $547;
     $594 = ($593>>>0)<(2147483647);
     if ($594) {
      $595 = ((($$0$i$i)) + 4|0);
      $596 = (_sbrk(($593|0))|0);
      $597 = HEAP32[$$0$i$i>>2]|0;
      $598 = HEAP32[$595>>2]|0;
      $599 = (($597) + ($598)|0);
      $600 = ($596|0)==($599|0);
      if ($600) {
       $601 = ($596|0)==((-1)|0);
       if ($601) {
        $$2234243136$i = $593;
       } else {
        $$723947$i = $593;$$748$i = $596;
        label = 190;
        break L257;
       }
      } else {
       $$2247$ph$i = $596;$$2253$ph$i = $593;
       label = 181;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 173) {
     $570 = (_sbrk(0)|0);
     $571 = ($570|0)==((-1)|0);
     if ($571) {
      $$2234243136$i = 0;
     } else {
      $572 = $570;
      $573 = HEAP32[(1660)>>2]|0;
      $574 = (($573) + -1)|0;
      $575 = $574 & $572;
      $576 = ($575|0)==(0);
      $577 = (($574) + ($572))|0;
      $578 = (0 - ($573))|0;
      $579 = $577 & $578;
      $580 = (($579) - ($572))|0;
      $581 = $576 ? 0 : $580;
      $spec$select49$i = (($581) + ($548))|0;
      $582 = HEAP32[(1616)>>2]|0;
      $583 = (($spec$select49$i) + ($582))|0;
      $584 = ($spec$select49$i>>>0)>($$0197>>>0);
      $585 = ($spec$select49$i>>>0)<(2147483647);
      $or$cond$i213 = $584 & $585;
      if ($or$cond$i213) {
       $586 = HEAP32[(1624)>>2]|0;
       $587 = ($586|0)==(0);
       if (!($587)) {
        $588 = ($583>>>0)<=($582>>>0);
        $589 = ($583>>>0)>($586>>>0);
        $or$cond2$i214 = $588 | $589;
        if ($or$cond2$i214) {
         $$2234243136$i = 0;
         break;
        }
       }
       $590 = (_sbrk(($spec$select49$i|0))|0);
       $591 = ($590|0)==($570|0);
       if ($591) {
        $$723947$i = $spec$select49$i;$$748$i = $570;
        label = 190;
        break L257;
       } else {
        $$2247$ph$i = $590;$$2253$ph$i = $spec$select49$i;
        label = 181;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 181) {
     $602 = (0 - ($$2253$ph$i))|0;
     $603 = ($$2247$ph$i|0)!=((-1)|0);
     $604 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $604 & $603;
     $605 = ($543>>>0)>($$2253$ph$i>>>0);
     $or$cond6$i = $605 & $or$cond7$i;
     if (!($or$cond6$i)) {
      $615 = ($$2247$ph$i|0)==((-1)|0);
      if ($615) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 190;
       break L257;
      }
     }
     $606 = HEAP32[(1664)>>2]|0;
     $607 = (($544) - ($$2253$ph$i))|0;
     $608 = (($607) + ($606))|0;
     $609 = (0 - ($606))|0;
     $610 = $608 & $609;
     $611 = ($610>>>0)<(2147483647);
     if (!($611)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 190;
      break L257;
     }
     $612 = (_sbrk(($610|0))|0);
     $613 = ($612|0)==((-1)|0);
     if ($613) {
      (_sbrk(($602|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $614 = (($610) + ($$2253$ph$i))|0;
      $$723947$i = $614;$$748$i = $$2247$ph$i;
      label = 190;
      break L257;
     }
    }
   } while(0);
   $616 = HEAP32[(1628)>>2]|0;
   $617 = $616 | 4;
   HEAP32[(1628)>>2] = $617;
   $$4236$i = $$2234243136$i;
   label = 188;
  } else {
   $$4236$i = 0;
   label = 188;
  }
 } while(0);
 if ((label|0) == 188) {
  $618 = ($548>>>0)<(2147483647);
  if ($618) {
   $619 = (_sbrk(($548|0))|0);
   $620 = (_sbrk(0)|0);
   $621 = ($619|0)!=((-1)|0);
   $622 = ($620|0)!=((-1)|0);
   $or$cond5$i = $621 & $622;
   $623 = ($619>>>0)<($620>>>0);
   $or$cond8$i = $623 & $or$cond5$i;
   $624 = $620;
   $625 = $619;
   $626 = (($624) - ($625))|0;
   $627 = (($$0197) + 40)|0;
   $628 = ($626>>>0)>($627>>>0);
   $spec$select9$i = $628 ? $626 : $$4236$i;
   $or$cond8$not$i = $or$cond8$i ^ 1;
   $629 = ($619|0)==((-1)|0);
   $not$$i = $628 ^ 1;
   $630 = $629 | $not$$i;
   $or$cond50$i = $630 | $or$cond8$not$i;
   if (!($or$cond50$i)) {
    $$723947$i = $spec$select9$i;$$748$i = $619;
    label = 190;
   }
  }
 }
 if ((label|0) == 190) {
  $631 = HEAP32[(1616)>>2]|0;
  $632 = (($631) + ($$723947$i))|0;
  HEAP32[(1616)>>2] = $632;
  $633 = HEAP32[(1620)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(1620)>>2] = $632;
  }
  $635 = HEAP32[(1208)>>2]|0;
  $636 = ($635|0)==(0|0);
  L294: do {
   if ($636) {
    $637 = HEAP32[(1200)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($$748$i>>>0)<($637>>>0);
    $or$cond11$i = $638 | $639;
    if ($or$cond11$i) {
     HEAP32[(1200)>>2] = $$748$i;
    }
    HEAP32[(1632)>>2] = $$748$i;
    HEAP32[(1636)>>2] = $$723947$i;
    HEAP32[(1644)>>2] = 0;
    $640 = HEAP32[414]|0;
    HEAP32[(1220)>>2] = $640;
    HEAP32[(1216)>>2] = -1;
    HEAP32[(1236)>>2] = (1224);
    HEAP32[(1232)>>2] = (1224);
    HEAP32[(1244)>>2] = (1232);
    HEAP32[(1240)>>2] = (1232);
    HEAP32[(1252)>>2] = (1240);
    HEAP32[(1248)>>2] = (1240);
    HEAP32[(1260)>>2] = (1248);
    HEAP32[(1256)>>2] = (1248);
    HEAP32[(1268)>>2] = (1256);
    HEAP32[(1264)>>2] = (1256);
    HEAP32[(1276)>>2] = (1264);
    HEAP32[(1272)>>2] = (1264);
    HEAP32[(1284)>>2] = (1272);
    HEAP32[(1280)>>2] = (1272);
    HEAP32[(1292)>>2] = (1280);
    HEAP32[(1288)>>2] = (1280);
    HEAP32[(1300)>>2] = (1288);
    HEAP32[(1296)>>2] = (1288);
    HEAP32[(1308)>>2] = (1296);
    HEAP32[(1304)>>2] = (1296);
    HEAP32[(1316)>>2] = (1304);
    HEAP32[(1312)>>2] = (1304);
    HEAP32[(1324)>>2] = (1312);
    HEAP32[(1320)>>2] = (1312);
    HEAP32[(1332)>>2] = (1320);
    HEAP32[(1328)>>2] = (1320);
    HEAP32[(1340)>>2] = (1328);
    HEAP32[(1336)>>2] = (1328);
    HEAP32[(1348)>>2] = (1336);
    HEAP32[(1344)>>2] = (1336);
    HEAP32[(1356)>>2] = (1344);
    HEAP32[(1352)>>2] = (1344);
    HEAP32[(1364)>>2] = (1352);
    HEAP32[(1360)>>2] = (1352);
    HEAP32[(1372)>>2] = (1360);
    HEAP32[(1368)>>2] = (1360);
    HEAP32[(1380)>>2] = (1368);
    HEAP32[(1376)>>2] = (1368);
    HEAP32[(1388)>>2] = (1376);
    HEAP32[(1384)>>2] = (1376);
    HEAP32[(1396)>>2] = (1384);
    HEAP32[(1392)>>2] = (1384);
    HEAP32[(1404)>>2] = (1392);
    HEAP32[(1400)>>2] = (1392);
    HEAP32[(1412)>>2] = (1400);
    HEAP32[(1408)>>2] = (1400);
    HEAP32[(1420)>>2] = (1408);
    HEAP32[(1416)>>2] = (1408);
    HEAP32[(1428)>>2] = (1416);
    HEAP32[(1424)>>2] = (1416);
    HEAP32[(1436)>>2] = (1424);
    HEAP32[(1432)>>2] = (1424);
    HEAP32[(1444)>>2] = (1432);
    HEAP32[(1440)>>2] = (1432);
    HEAP32[(1452)>>2] = (1440);
    HEAP32[(1448)>>2] = (1440);
    HEAP32[(1460)>>2] = (1448);
    HEAP32[(1456)>>2] = (1448);
    HEAP32[(1468)>>2] = (1456);
    HEAP32[(1464)>>2] = (1456);
    HEAP32[(1476)>>2] = (1464);
    HEAP32[(1472)>>2] = (1464);
    HEAP32[(1484)>>2] = (1472);
    HEAP32[(1480)>>2] = (1472);
    $641 = (($$723947$i) + -40)|0;
    $642 = ((($$748$i)) + 8|0);
    $643 = $642;
    $644 = $643 & 7;
    $645 = ($644|0)==(0);
    $646 = (0 - ($643))|0;
    $647 = $646 & 7;
    $648 = $645 ? 0 : $647;
    $649 = (($$748$i) + ($648)|0);
    $650 = (($641) - ($648))|0;
    HEAP32[(1208)>>2] = $649;
    HEAP32[(1196)>>2] = $650;
    $651 = $650 | 1;
    $652 = ((($649)) + 4|0);
    HEAP32[$652>>2] = $651;
    $653 = (($$748$i) + ($641)|0);
    $654 = ((($653)) + 4|0);
    HEAP32[$654>>2] = 40;
    $655 = HEAP32[(1672)>>2]|0;
    HEAP32[(1212)>>2] = $655;
   } else {
    $$024372$i = (1632);
    while(1) {
     $656 = HEAP32[$$024372$i>>2]|0;
     $657 = ((($$024372$i)) + 4|0);
     $658 = HEAP32[$657>>2]|0;
     $659 = (($656) + ($658)|0);
     $660 = ($$748$i|0)==($659|0);
     if ($660) {
      label = 199;
      break;
     }
     $661 = ((($$024372$i)) + 8|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = ($662|0)==(0|0);
     if ($663) {
      break;
     } else {
      $$024372$i = $662;
     }
    }
    if ((label|0) == 199) {
     $664 = ((($$024372$i)) + 4|0);
     $665 = ((($$024372$i)) + 12|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = $666 & 8;
     $668 = ($667|0)==(0);
     if ($668) {
      $669 = ($656>>>0)<=($635>>>0);
      $670 = ($$748$i>>>0)>($635>>>0);
      $or$cond51$i = $670 & $669;
      if ($or$cond51$i) {
       $671 = (($658) + ($$723947$i))|0;
       HEAP32[$664>>2] = $671;
       $672 = HEAP32[(1196)>>2]|0;
       $673 = (($672) + ($$723947$i))|0;
       $674 = ((($635)) + 8|0);
       $675 = $674;
       $676 = $675 & 7;
       $677 = ($676|0)==(0);
       $678 = (0 - ($675))|0;
       $679 = $678 & 7;
       $680 = $677 ? 0 : $679;
       $681 = (($635) + ($680)|0);
       $682 = (($673) - ($680))|0;
       HEAP32[(1208)>>2] = $681;
       HEAP32[(1196)>>2] = $682;
       $683 = $682 | 1;
       $684 = ((($681)) + 4|0);
       HEAP32[$684>>2] = $683;
       $685 = (($635) + ($673)|0);
       $686 = ((($685)) + 4|0);
       HEAP32[$686>>2] = 40;
       $687 = HEAP32[(1672)>>2]|0;
       HEAP32[(1212)>>2] = $687;
       break;
      }
     }
    }
    $688 = HEAP32[(1200)>>2]|0;
    $689 = ($$748$i>>>0)<($688>>>0);
    if ($689) {
     HEAP32[(1200)>>2] = $$748$i;
     $753 = $$748$i;
    } else {
     $753 = $688;
    }
    $690 = (($$748$i) + ($$723947$i)|0);
    $$124471$i = (1632);
    while(1) {
     $691 = HEAP32[$$124471$i>>2]|0;
     $692 = ($691|0)==($690|0);
     if ($692) {
      label = 207;
      break;
     }
     $693 = ((($$124471$i)) + 8|0);
     $694 = HEAP32[$693>>2]|0;
     $695 = ($694|0)==(0|0);
     if ($695) {
      break;
     } else {
      $$124471$i = $694;
     }
    }
    if ((label|0) == 207) {
     $696 = ((($$124471$i)) + 12|0);
     $697 = HEAP32[$696>>2]|0;
     $698 = $697 & 8;
     $699 = ($698|0)==(0);
     if ($699) {
      HEAP32[$$124471$i>>2] = $$748$i;
      $700 = ((($$124471$i)) + 4|0);
      $701 = HEAP32[$700>>2]|0;
      $702 = (($701) + ($$723947$i))|0;
      HEAP32[$700>>2] = $702;
      $703 = ((($$748$i)) + 8|0);
      $704 = $703;
      $705 = $704 & 7;
      $706 = ($705|0)==(0);
      $707 = (0 - ($704))|0;
      $708 = $707 & 7;
      $709 = $706 ? 0 : $708;
      $710 = (($$748$i) + ($709)|0);
      $711 = ((($690)) + 8|0);
      $712 = $711;
      $713 = $712 & 7;
      $714 = ($713|0)==(0);
      $715 = (0 - ($712))|0;
      $716 = $715 & 7;
      $717 = $714 ? 0 : $716;
      $718 = (($690) + ($717)|0);
      $719 = $718;
      $720 = $710;
      $721 = (($719) - ($720))|0;
      $722 = (($710) + ($$0197)|0);
      $723 = (($721) - ($$0197))|0;
      $724 = $$0197 | 3;
      $725 = ((($710)) + 4|0);
      HEAP32[$725>>2] = $724;
      $726 = ($635|0)==($718|0);
      L317: do {
       if ($726) {
        $727 = HEAP32[(1196)>>2]|0;
        $728 = (($727) + ($723))|0;
        HEAP32[(1196)>>2] = $728;
        HEAP32[(1208)>>2] = $722;
        $729 = $728 | 1;
        $730 = ((($722)) + 4|0);
        HEAP32[$730>>2] = $729;
       } else {
        $731 = HEAP32[(1204)>>2]|0;
        $732 = ($731|0)==($718|0);
        if ($732) {
         $733 = HEAP32[(1192)>>2]|0;
         $734 = (($733) + ($723))|0;
         HEAP32[(1192)>>2] = $734;
         HEAP32[(1204)>>2] = $722;
         $735 = $734 | 1;
         $736 = ((($722)) + 4|0);
         HEAP32[$736>>2] = $735;
         $737 = (($722) + ($734)|0);
         HEAP32[$737>>2] = $734;
         break;
        }
        $738 = ((($718)) + 4|0);
        $739 = HEAP32[$738>>2]|0;
        $740 = $739 & 3;
        $741 = ($740|0)==(1);
        if ($741) {
         $742 = $739 & -8;
         $743 = $739 >>> 3;
         $744 = ($739>>>0)<(256);
         L325: do {
          if ($744) {
           $745 = ((($718)) + 8|0);
           $746 = HEAP32[$745>>2]|0;
           $747 = ((($718)) + 12|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = $743 << 1;
           $750 = (1224 + ($749<<2)|0);
           $751 = ($746|0)==($750|0);
           do {
            if (!($751)) {
             $752 = ($753>>>0)>($746>>>0);
             if ($752) {
              _abort();
              // unreachable;
             }
             $754 = ((($746)) + 12|0);
             $755 = HEAP32[$754>>2]|0;
             $756 = ($755|0)==($718|0);
             if ($756) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $757 = ($748|0)==($746|0);
           if ($757) {
            $758 = 1 << $743;
            $759 = $758 ^ -1;
            $760 = HEAP32[296]|0;
            $761 = $760 & $759;
            HEAP32[296] = $761;
            break;
           }
           $762 = ($748|0)==($750|0);
           do {
            if ($762) {
             $$pre16$i$i = ((($748)) + 8|0);
             $$pre$phi17$i$iZ2D = $$pre16$i$i;
            } else {
             $763 = ($753>>>0)>($748>>>0);
             if ($763) {
              _abort();
              // unreachable;
             }
             $764 = ((($748)) + 8|0);
             $765 = HEAP32[$764>>2]|0;
             $766 = ($765|0)==($718|0);
             if ($766) {
              $$pre$phi17$i$iZ2D = $764;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $767 = ((($746)) + 12|0);
           HEAP32[$767>>2] = $748;
           HEAP32[$$pre$phi17$i$iZ2D>>2] = $746;
          } else {
           $768 = ((($718)) + 24|0);
           $769 = HEAP32[$768>>2]|0;
           $770 = ((($718)) + 12|0);
           $771 = HEAP32[$770>>2]|0;
           $772 = ($771|0)==($718|0);
           do {
            if ($772) {
             $782 = ((($718)) + 16|0);
             $783 = ((($782)) + 4|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==(0|0);
             if ($785) {
              $786 = HEAP32[$782>>2]|0;
              $787 = ($786|0)==(0|0);
              if ($787) {
               $$3$i$i = 0;
               break;
              } else {
               $$1290$i$i$ph = $786;$$1292$i$i$ph = $782;
              }
             } else {
              $$1290$i$i$ph = $784;$$1292$i$i$ph = $783;
             }
             $$1290$i$i = $$1290$i$i$ph;$$1292$i$i = $$1292$i$i$ph;
             while(1) {
              $788 = ((($$1290$i$i)) + 20|0);
              $789 = HEAP32[$788>>2]|0;
              $790 = ($789|0)==(0|0);
              if ($790) {
               $791 = ((($$1290$i$i)) + 16|0);
               $792 = HEAP32[$791>>2]|0;
               $793 = ($792|0)==(0|0);
               if ($793) {
                break;
               } else {
                $$1290$i$i$be = $792;$$1292$i$i$be = $791;
               }
              } else {
               $$1290$i$i$be = $789;$$1292$i$i$be = $788;
              }
              $$1290$i$i = $$1290$i$i$be;$$1292$i$i = $$1292$i$i$be;
             }
             $794 = ($753>>>0)>($$1292$i$i>>>0);
             if ($794) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1292$i$i>>2] = 0;
              $$3$i$i = $$1290$i$i;
              break;
             }
            } else {
             $773 = ((($718)) + 8|0);
             $774 = HEAP32[$773>>2]|0;
             $775 = ($753>>>0)>($774>>>0);
             if ($775) {
              _abort();
              // unreachable;
             }
             $776 = ((($774)) + 12|0);
             $777 = HEAP32[$776>>2]|0;
             $778 = ($777|0)==($718|0);
             if (!($778)) {
              _abort();
              // unreachable;
             }
             $779 = ((($771)) + 8|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==($718|0);
             if ($781) {
              HEAP32[$776>>2] = $771;
              HEAP32[$779>>2] = $774;
              $$3$i$i = $771;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $795 = ($769|0)==(0|0);
           if ($795) {
            break;
           }
           $796 = ((($718)) + 28|0);
           $797 = HEAP32[$796>>2]|0;
           $798 = (1488 + ($797<<2)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = ($799|0)==($718|0);
           do {
            if ($800) {
             HEAP32[$798>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $801 = 1 << $797;
             $802 = $801 ^ -1;
             $803 = HEAP32[(1188)>>2]|0;
             $804 = $803 & $802;
             HEAP32[(1188)>>2] = $804;
             break L325;
            } else {
             $805 = HEAP32[(1200)>>2]|0;
             $806 = ($805>>>0)>($769>>>0);
             if ($806) {
              _abort();
              // unreachable;
             } else {
              $807 = ((($769)) + 16|0);
              $808 = HEAP32[$807>>2]|0;
              $809 = ($808|0)==($718|0);
              $810 = ((($769)) + 20|0);
              $$sink326 = $809 ? $807 : $810;
              HEAP32[$$sink326>>2] = $$3$i$i;
              $811 = ($$3$i$i|0)==(0|0);
              if ($811) {
               break L325;
              } else {
               break;
              }
             }
            }
           } while(0);
           $812 = HEAP32[(1200)>>2]|0;
           $813 = ($812>>>0)>($$3$i$i>>>0);
           if ($813) {
            _abort();
            // unreachable;
           }
           $814 = ((($$3$i$i)) + 24|0);
           HEAP32[$814>>2] = $769;
           $815 = ((($718)) + 16|0);
           $816 = HEAP32[$815>>2]|0;
           $817 = ($816|0)==(0|0);
           do {
            if (!($817)) {
             $818 = ($812>>>0)>($816>>>0);
             if ($818) {
              _abort();
              // unreachable;
             } else {
              $819 = ((($$3$i$i)) + 16|0);
              HEAP32[$819>>2] = $816;
              $820 = ((($816)) + 24|0);
              HEAP32[$820>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $821 = ((($815)) + 4|0);
           $822 = HEAP32[$821>>2]|0;
           $823 = ($822|0)==(0|0);
           if ($823) {
            break;
           }
           $824 = HEAP32[(1200)>>2]|0;
           $825 = ($824>>>0)>($822>>>0);
           if ($825) {
            _abort();
            // unreachable;
           } else {
            $826 = ((($$3$i$i)) + 20|0);
            HEAP32[$826>>2] = $822;
            $827 = ((($822)) + 24|0);
            HEAP32[$827>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $828 = (($718) + ($742)|0);
         $829 = (($742) + ($723))|0;
         $$0$i16$i = $828;$$0286$i$i = $829;
        } else {
         $$0$i16$i = $718;$$0286$i$i = $723;
        }
        $830 = ((($$0$i16$i)) + 4|0);
        $831 = HEAP32[$830>>2]|0;
        $832 = $831 & -2;
        HEAP32[$830>>2] = $832;
        $833 = $$0286$i$i | 1;
        $834 = ((($722)) + 4|0);
        HEAP32[$834>>2] = $833;
        $835 = (($722) + ($$0286$i$i)|0);
        HEAP32[$835>>2] = $$0286$i$i;
        $836 = $$0286$i$i >>> 3;
        $837 = ($$0286$i$i>>>0)<(256);
        if ($837) {
         $838 = $836 << 1;
         $839 = (1224 + ($838<<2)|0);
         $840 = HEAP32[296]|0;
         $841 = 1 << $836;
         $842 = $840 & $841;
         $843 = ($842|0)==(0);
         do {
          if ($843) {
           $844 = $840 | $841;
           HEAP32[296] = $844;
           $$pre$i17$i = ((($839)) + 8|0);
           $$0294$i$i = $839;$$pre$phi$i18$iZ2D = $$pre$i17$i;
          } else {
           $845 = ((($839)) + 8|0);
           $846 = HEAP32[$845>>2]|0;
           $847 = HEAP32[(1200)>>2]|0;
           $848 = ($847>>>0)>($846>>>0);
           if (!($848)) {
            $$0294$i$i = $846;$$pre$phi$i18$iZ2D = $845;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $722;
         $849 = ((($$0294$i$i)) + 12|0);
         HEAP32[$849>>2] = $722;
         $850 = ((($722)) + 8|0);
         HEAP32[$850>>2] = $$0294$i$i;
         $851 = ((($722)) + 12|0);
         HEAP32[$851>>2] = $839;
         break;
        }
        $852 = $$0286$i$i >>> 8;
        $853 = ($852|0)==(0);
        do {
         if ($853) {
          $$0295$i$i = 0;
         } else {
          $854 = ($$0286$i$i>>>0)>(16777215);
          if ($854) {
           $$0295$i$i = 31;
           break;
          }
          $855 = (($852) + 1048320)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 8;
          $858 = $852 << $857;
          $859 = (($858) + 520192)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 4;
          $862 = $861 | $857;
          $863 = $858 << $861;
          $864 = (($863) + 245760)|0;
          $865 = $864 >>> 16;
          $866 = $865 & 2;
          $867 = $862 | $866;
          $868 = (14 - ($867))|0;
          $869 = $863 << $866;
          $870 = $869 >>> 15;
          $871 = (($868) + ($870))|0;
          $872 = $871 << 1;
          $873 = (($871) + 7)|0;
          $874 = $$0286$i$i >>> $873;
          $875 = $874 & 1;
          $876 = $875 | $872;
          $$0295$i$i = $876;
         }
        } while(0);
        $877 = (1488 + ($$0295$i$i<<2)|0);
        $878 = ((($722)) + 28|0);
        HEAP32[$878>>2] = $$0295$i$i;
        $879 = ((($722)) + 16|0);
        $880 = ((($879)) + 4|0);
        HEAP32[$880>>2] = 0;
        HEAP32[$879>>2] = 0;
        $881 = HEAP32[(1188)>>2]|0;
        $882 = 1 << $$0295$i$i;
        $883 = $881 & $882;
        $884 = ($883|0)==(0);
        if ($884) {
         $885 = $881 | $882;
         HEAP32[(1188)>>2] = $885;
         HEAP32[$877>>2] = $722;
         $886 = ((($722)) + 24|0);
         HEAP32[$886>>2] = $877;
         $887 = ((($722)) + 12|0);
         HEAP32[$887>>2] = $722;
         $888 = ((($722)) + 8|0);
         HEAP32[$888>>2] = $722;
         break;
        }
        $889 = HEAP32[$877>>2]|0;
        $890 = ((($889)) + 4|0);
        $891 = HEAP32[$890>>2]|0;
        $892 = $891 & -8;
        $893 = ($892|0)==($$0286$i$i|0);
        L410: do {
         if ($893) {
          $$0288$lcssa$i$i = $889;
         } else {
          $894 = ($$0295$i$i|0)==(31);
          $895 = $$0295$i$i >>> 1;
          $896 = (25 - ($895))|0;
          $897 = $894 ? 0 : $896;
          $898 = $$0286$i$i << $897;
          $$028711$i$i = $898;$$028810$i$i = $889;
          while(1) {
           $905 = $$028711$i$i >>> 31;
           $906 = (((($$028810$i$i)) + 16|0) + ($905<<2)|0);
           $901 = HEAP32[$906>>2]|0;
           $907 = ($901|0)==(0|0);
           if ($907) {
            break;
           }
           $899 = $$028711$i$i << 1;
           $900 = ((($901)) + 4|0);
           $902 = HEAP32[$900>>2]|0;
           $903 = $902 & -8;
           $904 = ($903|0)==($$0286$i$i|0);
           if ($904) {
            $$0288$lcssa$i$i = $901;
            break L410;
           } else {
            $$028711$i$i = $899;$$028810$i$i = $901;
           }
          }
          $908 = HEAP32[(1200)>>2]|0;
          $909 = ($908>>>0)>($906>>>0);
          if ($909) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$906>>2] = $722;
           $910 = ((($722)) + 24|0);
           HEAP32[$910>>2] = $$028810$i$i;
           $911 = ((($722)) + 12|0);
           HEAP32[$911>>2] = $722;
           $912 = ((($722)) + 8|0);
           HEAP32[$912>>2] = $722;
           break L317;
          }
         }
        } while(0);
        $913 = ((($$0288$lcssa$i$i)) + 8|0);
        $914 = HEAP32[$913>>2]|0;
        $915 = HEAP32[(1200)>>2]|0;
        $916 = ($915>>>0)<=($$0288$lcssa$i$i>>>0);
        $917 = ($915>>>0)<=($914>>>0);
        $918 = $917 & $916;
        if ($918) {
         $919 = ((($914)) + 12|0);
         HEAP32[$919>>2] = $722;
         HEAP32[$913>>2] = $722;
         $920 = ((($722)) + 8|0);
         HEAP32[$920>>2] = $914;
         $921 = ((($722)) + 12|0);
         HEAP32[$921>>2] = $$0288$lcssa$i$i;
         $922 = ((($722)) + 24|0);
         HEAP32[$922>>2] = 0;
         break;
        } else {
         _abort();
         // unreachable;
        }
       }
      } while(0);
      $1059 = ((($710)) + 8|0);
      $$0 = $1059;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (1632);
    while(1) {
     $923 = HEAP32[$$0$i$i$i>>2]|0;
     $924 = ($923>>>0)>($635>>>0);
     if (!($924)) {
      $925 = ((($$0$i$i$i)) + 4|0);
      $926 = HEAP32[$925>>2]|0;
      $927 = (($923) + ($926)|0);
      $928 = ($927>>>0)>($635>>>0);
      if ($928) {
       break;
      }
     }
     $929 = ((($$0$i$i$i)) + 8|0);
     $930 = HEAP32[$929>>2]|0;
     $$0$i$i$i = $930;
    }
    $931 = ((($927)) + -47|0);
    $932 = ((($931)) + 8|0);
    $933 = $932;
    $934 = $933 & 7;
    $935 = ($934|0)==(0);
    $936 = (0 - ($933))|0;
    $937 = $936 & 7;
    $938 = $935 ? 0 : $937;
    $939 = (($931) + ($938)|0);
    $940 = ((($635)) + 16|0);
    $941 = ($939>>>0)<($940>>>0);
    $942 = $941 ? $635 : $939;
    $943 = ((($942)) + 8|0);
    $944 = ((($942)) + 24|0);
    $945 = (($$723947$i) + -40)|0;
    $946 = ((($$748$i)) + 8|0);
    $947 = $946;
    $948 = $947 & 7;
    $949 = ($948|0)==(0);
    $950 = (0 - ($947))|0;
    $951 = $950 & 7;
    $952 = $949 ? 0 : $951;
    $953 = (($$748$i) + ($952)|0);
    $954 = (($945) - ($952))|0;
    HEAP32[(1208)>>2] = $953;
    HEAP32[(1196)>>2] = $954;
    $955 = $954 | 1;
    $956 = ((($953)) + 4|0);
    HEAP32[$956>>2] = $955;
    $957 = (($$748$i) + ($945)|0);
    $958 = ((($957)) + 4|0);
    HEAP32[$958>>2] = 40;
    $959 = HEAP32[(1672)>>2]|0;
    HEAP32[(1212)>>2] = $959;
    $960 = ((($942)) + 4|0);
    HEAP32[$960>>2] = 27;
    ;HEAP32[$943>>2]=HEAP32[(1632)>>2]|0;HEAP32[$943+4>>2]=HEAP32[(1632)+4>>2]|0;HEAP32[$943+8>>2]=HEAP32[(1632)+8>>2]|0;HEAP32[$943+12>>2]=HEAP32[(1632)+12>>2]|0;
    HEAP32[(1632)>>2] = $$748$i;
    HEAP32[(1636)>>2] = $$723947$i;
    HEAP32[(1644)>>2] = 0;
    HEAP32[(1640)>>2] = $943;
    $962 = $944;
    while(1) {
     $961 = ((($962)) + 4|0);
     HEAP32[$961>>2] = 7;
     $963 = ((($962)) + 8|0);
     $964 = ($963>>>0)<($927>>>0);
     if ($964) {
      $962 = $961;
     } else {
      break;
     }
    }
    $965 = ($942|0)==($635|0);
    if (!($965)) {
     $966 = $942;
     $967 = $635;
     $968 = (($966) - ($967))|0;
     $969 = HEAP32[$960>>2]|0;
     $970 = $969 & -2;
     HEAP32[$960>>2] = $970;
     $971 = $968 | 1;
     $972 = ((($635)) + 4|0);
     HEAP32[$972>>2] = $971;
     HEAP32[$942>>2] = $968;
     $973 = $968 >>> 3;
     $974 = ($968>>>0)<(256);
     if ($974) {
      $975 = $973 << 1;
      $976 = (1224 + ($975<<2)|0);
      $977 = HEAP32[296]|0;
      $978 = 1 << $973;
      $979 = $977 & $978;
      $980 = ($979|0)==(0);
      if ($980) {
       $981 = $977 | $978;
       HEAP32[296] = $981;
       $$pre$i$i = ((($976)) + 8|0);
       $$0211$i$i = $976;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $982 = ((($976)) + 8|0);
       $983 = HEAP32[$982>>2]|0;
       $984 = HEAP32[(1200)>>2]|0;
       $985 = ($984>>>0)>($983>>>0);
       if ($985) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $983;$$pre$phi$i$iZ2D = $982;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $986 = ((($$0211$i$i)) + 12|0);
      HEAP32[$986>>2] = $635;
      $987 = ((($635)) + 8|0);
      HEAP32[$987>>2] = $$0211$i$i;
      $988 = ((($635)) + 12|0);
      HEAP32[$988>>2] = $976;
      break;
     }
     $989 = $968 >>> 8;
     $990 = ($989|0)==(0);
     if ($990) {
      $$0212$i$i = 0;
     } else {
      $991 = ($968>>>0)>(16777215);
      if ($991) {
       $$0212$i$i = 31;
      } else {
       $992 = (($989) + 1048320)|0;
       $993 = $992 >>> 16;
       $994 = $993 & 8;
       $995 = $989 << $994;
       $996 = (($995) + 520192)|0;
       $997 = $996 >>> 16;
       $998 = $997 & 4;
       $999 = $998 | $994;
       $1000 = $995 << $998;
       $1001 = (($1000) + 245760)|0;
       $1002 = $1001 >>> 16;
       $1003 = $1002 & 2;
       $1004 = $999 | $1003;
       $1005 = (14 - ($1004))|0;
       $1006 = $1000 << $1003;
       $1007 = $1006 >>> 15;
       $1008 = (($1005) + ($1007))|0;
       $1009 = $1008 << 1;
       $1010 = (($1008) + 7)|0;
       $1011 = $968 >>> $1010;
       $1012 = $1011 & 1;
       $1013 = $1012 | $1009;
       $$0212$i$i = $1013;
      }
     }
     $1014 = (1488 + ($$0212$i$i<<2)|0);
     $1015 = ((($635)) + 28|0);
     HEAP32[$1015>>2] = $$0212$i$i;
     $1016 = ((($635)) + 20|0);
     HEAP32[$1016>>2] = 0;
     HEAP32[$940>>2] = 0;
     $1017 = HEAP32[(1188)>>2]|0;
     $1018 = 1 << $$0212$i$i;
     $1019 = $1017 & $1018;
     $1020 = ($1019|0)==(0);
     if ($1020) {
      $1021 = $1017 | $1018;
      HEAP32[(1188)>>2] = $1021;
      HEAP32[$1014>>2] = $635;
      $1022 = ((($635)) + 24|0);
      HEAP32[$1022>>2] = $1014;
      $1023 = ((($635)) + 12|0);
      HEAP32[$1023>>2] = $635;
      $1024 = ((($635)) + 8|0);
      HEAP32[$1024>>2] = $635;
      break;
     }
     $1025 = HEAP32[$1014>>2]|0;
     $1026 = ((($1025)) + 4|0);
     $1027 = HEAP32[$1026>>2]|0;
     $1028 = $1027 & -8;
     $1029 = ($1028|0)==($968|0);
     L451: do {
      if ($1029) {
       $$0207$lcssa$i$i = $1025;
      } else {
       $1030 = ($$0212$i$i|0)==(31);
       $1031 = $$0212$i$i >>> 1;
       $1032 = (25 - ($1031))|0;
       $1033 = $1030 ? 0 : $1032;
       $1034 = $968 << $1033;
       $$02065$i$i = $1034;$$02074$i$i = $1025;
       while(1) {
        $1041 = $$02065$i$i >>> 31;
        $1042 = (((($$02074$i$i)) + 16|0) + ($1041<<2)|0);
        $1037 = HEAP32[$1042>>2]|0;
        $1043 = ($1037|0)==(0|0);
        if ($1043) {
         break;
        }
        $1035 = $$02065$i$i << 1;
        $1036 = ((($1037)) + 4|0);
        $1038 = HEAP32[$1036>>2]|0;
        $1039 = $1038 & -8;
        $1040 = ($1039|0)==($968|0);
        if ($1040) {
         $$0207$lcssa$i$i = $1037;
         break L451;
        } else {
         $$02065$i$i = $1035;$$02074$i$i = $1037;
        }
       }
       $1044 = HEAP32[(1200)>>2]|0;
       $1045 = ($1044>>>0)>($1042>>>0);
       if ($1045) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$1042>>2] = $635;
        $1046 = ((($635)) + 24|0);
        HEAP32[$1046>>2] = $$02074$i$i;
        $1047 = ((($635)) + 12|0);
        HEAP32[$1047>>2] = $635;
        $1048 = ((($635)) + 8|0);
        HEAP32[$1048>>2] = $635;
        break L294;
       }
      }
     } while(0);
     $1049 = ((($$0207$lcssa$i$i)) + 8|0);
     $1050 = HEAP32[$1049>>2]|0;
     $1051 = HEAP32[(1200)>>2]|0;
     $1052 = ($1051>>>0)<=($$0207$lcssa$i$i>>>0);
     $1053 = ($1051>>>0)<=($1050>>>0);
     $1054 = $1053 & $1052;
     if ($1054) {
      $1055 = ((($1050)) + 12|0);
      HEAP32[$1055>>2] = $635;
      HEAP32[$1049>>2] = $635;
      $1056 = ((($635)) + 8|0);
      HEAP32[$1056>>2] = $1050;
      $1057 = ((($635)) + 12|0);
      HEAP32[$1057>>2] = $$0207$lcssa$i$i;
      $1058 = ((($635)) + 24|0);
      HEAP32[$1058>>2] = 0;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   }
  } while(0);
  $1060 = HEAP32[(1196)>>2]|0;
  $1061 = ($1060>>>0)>($$0197>>>0);
  if ($1061) {
   $1062 = (($1060) - ($$0197))|0;
   HEAP32[(1196)>>2] = $1062;
   $1063 = HEAP32[(1208)>>2]|0;
   $1064 = (($1063) + ($$0197)|0);
   HEAP32[(1208)>>2] = $1064;
   $1065 = $1062 | 1;
   $1066 = ((($1064)) + 4|0);
   HEAP32[$1066>>2] = $1065;
   $1067 = $$0197 | 3;
   $1068 = ((($1063)) + 4|0);
   HEAP32[$1068>>2] = $1067;
   $1069 = ((($1063)) + 8|0);
   $$0 = $1069;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1070 = (___errno_location()|0);
 HEAP32[$1070>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381438 = 0, $$0382$lcssa = 0, $$0382437 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1385$be = 0, $$1385$ph = 0, $$1388 = 0, $$1388$be = 0, $$1388$ph = 0, $$1396 = 0, $$1396$be = 0, $$1396$ph = 0, $$1400 = 0, $$1400$be = 0;
 var $$1400$ph = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre = 0, $$pre$phi444Z2D = 0, $$pre$phi446Z2D = 0, $$pre$phiZ2D = 0, $$pre443 = 0, $$pre445 = 0, $$sink = 0, $$sink456 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0;
 var $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0;
 var $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0;
 var $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0;
 var $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0;
 var $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0;
 var $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0;
 var $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond419 = 0, $cond420 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(1200)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 L10: do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(1204)>>2]|0;
   $20 = ($19|0)==($16|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1380 = $17;$114 = $16;
     break;
    }
    $109 = (($16) + ($17)|0);
    $110 = ((($16)) + 4|0);
    $111 = $17 | 1;
    $112 = $106 & -2;
    HEAP32[(1192)>>2] = $17;
    HEAP32[$105>>2] = $112;
    HEAP32[$110>>2] = $111;
    HEAP32[$109>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (1224 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($3>>>0)>($24>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[296]|0;
     $38 = $37 & $36;
     HEAP32[296] = $38;
     $$1 = $16;$$1380 = $17;$114 = $16;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre445 = ((($26)) + 8|0);
     $$pre$phi446Z2D = $$pre445;
    } else {
     $40 = ($3>>>0)>($26>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi446Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi446Z2D>>2] = $24;
    $$1 = $16;$$1380 = $17;$114 = $16;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1385$ph = $63;$$1388$ph = $59;
      }
     } else {
      $$1385$ph = $61;$$1388$ph = $60;
     }
     $$1385 = $$1385$ph;$$1388 = $$1388$ph;
     while(1) {
      $65 = ((($$1385)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if ($67) {
       $68 = ((($$1385)) + 16|0);
       $69 = HEAP32[$68>>2]|0;
       $70 = ($69|0)==(0|0);
       if ($70) {
        break;
       } else {
        $$1385$be = $69;$$1388$be = $68;
       }
      } else {
       $$1385$be = $66;$$1388$be = $65;
      }
      $$1385 = $$1385$be;$$1388 = $$1388$be;
     }
     $71 = ($3>>>0)>($$1388>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1388>>2] = 0;
      $$3 = $$1385;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($3>>>0)>($51>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1380 = $17;$114 = $16;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (1488 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($76|0)==($16|0);
    do {
     if ($77) {
      HEAP32[$75>>2] = $$3;
      $cond419 = ($$3|0)==(0|0);
      if ($cond419) {
       $78 = 1 << $74;
       $79 = $78 ^ -1;
       $80 = HEAP32[(1188)>>2]|0;
       $81 = $80 & $79;
       HEAP32[(1188)>>2] = $81;
       $$1 = $16;$$1380 = $17;$114 = $16;
       break L10;
      }
     } else {
      $82 = HEAP32[(1200)>>2]|0;
      $83 = ($82>>>0)>($46>>>0);
      if ($83) {
       _abort();
       // unreachable;
      } else {
       $84 = ((($46)) + 16|0);
       $85 = HEAP32[$84>>2]|0;
       $86 = ($85|0)==($16|0);
       $87 = ((($46)) + 20|0);
       $$sink = $86 ? $84 : $87;
       HEAP32[$$sink>>2] = $$3;
       $88 = ($$3|0)==(0|0);
       if ($88) {
        $$1 = $16;$$1380 = $17;$114 = $16;
        break L10;
       } else {
        break;
       }
      }
     }
    } while(0);
    $89 = HEAP32[(1200)>>2]|0;
    $90 = ($89>>>0)>($$3>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($89>>>0)>($93>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1380 = $17;$114 = $16;
    } else {
     $101 = HEAP32[(1200)>>2]|0;
     $102 = ($101>>>0)>($99>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1380 = $17;$114 = $16;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1380 = $9;$114 = $2;
  }
 } while(0);
 $113 = ($114>>>0)<($10>>>0);
 if (!($113)) {
  _abort();
  // unreachable;
 }
 $115 = ((($10)) + 4|0);
 $116 = HEAP32[$115>>2]|0;
 $117 = $116 & 1;
 $118 = ($117|0)==(0);
 if ($118) {
  _abort();
  // unreachable;
 }
 $119 = $116 & 2;
 $120 = ($119|0)==(0);
 if ($120) {
  $121 = HEAP32[(1208)>>2]|0;
  $122 = ($121|0)==($10|0);
  if ($122) {
   $123 = HEAP32[(1196)>>2]|0;
   $124 = (($123) + ($$1380))|0;
   HEAP32[(1196)>>2] = $124;
   HEAP32[(1208)>>2] = $$1;
   $125 = $124 | 1;
   $126 = ((($$1)) + 4|0);
   HEAP32[$126>>2] = $125;
   $127 = HEAP32[(1204)>>2]|0;
   $128 = ($$1|0)==($127|0);
   if (!($128)) {
    return;
   }
   HEAP32[(1204)>>2] = 0;
   HEAP32[(1192)>>2] = 0;
   return;
  }
  $129 = HEAP32[(1204)>>2]|0;
  $130 = ($129|0)==($10|0);
  if ($130) {
   $131 = HEAP32[(1192)>>2]|0;
   $132 = (($131) + ($$1380))|0;
   HEAP32[(1192)>>2] = $132;
   HEAP32[(1204)>>2] = $114;
   $133 = $132 | 1;
   $134 = ((($$1)) + 4|0);
   HEAP32[$134>>2] = $133;
   $135 = (($114) + ($132)|0);
   HEAP32[$135>>2] = $132;
   return;
  }
  $136 = $116 & -8;
  $137 = (($136) + ($$1380))|0;
  $138 = $116 >>> 3;
  $139 = ($116>>>0)<(256);
  L111: do {
   if ($139) {
    $140 = ((($10)) + 8|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = ((($10)) + 12|0);
    $143 = HEAP32[$142>>2]|0;
    $144 = $138 << 1;
    $145 = (1224 + ($144<<2)|0);
    $146 = ($141|0)==($145|0);
    if (!($146)) {
     $147 = HEAP32[(1200)>>2]|0;
     $148 = ($147>>>0)>($141>>>0);
     if ($148) {
      _abort();
      // unreachable;
     }
     $149 = ((($141)) + 12|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($10|0);
     if (!($151)) {
      _abort();
      // unreachable;
     }
    }
    $152 = ($143|0)==($141|0);
    if ($152) {
     $153 = 1 << $138;
     $154 = $153 ^ -1;
     $155 = HEAP32[296]|0;
     $156 = $155 & $154;
     HEAP32[296] = $156;
     break;
    }
    $157 = ($143|0)==($145|0);
    if ($157) {
     $$pre443 = ((($143)) + 8|0);
     $$pre$phi444Z2D = $$pre443;
    } else {
     $158 = HEAP32[(1200)>>2]|0;
     $159 = ($158>>>0)>($143>>>0);
     if ($159) {
      _abort();
      // unreachable;
     }
     $160 = ((($143)) + 8|0);
     $161 = HEAP32[$160>>2]|0;
     $162 = ($161|0)==($10|0);
     if ($162) {
      $$pre$phi444Z2D = $160;
     } else {
      _abort();
      // unreachable;
     }
    }
    $163 = ((($141)) + 12|0);
    HEAP32[$163>>2] = $143;
    HEAP32[$$pre$phi444Z2D>>2] = $141;
   } else {
    $164 = ((($10)) + 24|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ((($10)) + 12|0);
    $167 = HEAP32[$166>>2]|0;
    $168 = ($167|0)==($10|0);
    do {
     if ($168) {
      $179 = ((($10)) + 16|0);
      $180 = ((($179)) + 4|0);
      $181 = HEAP32[$180>>2]|0;
      $182 = ($181|0)==(0|0);
      if ($182) {
       $183 = HEAP32[$179>>2]|0;
       $184 = ($183|0)==(0|0);
       if ($184) {
        $$3398 = 0;
        break;
       } else {
        $$1396$ph = $183;$$1400$ph = $179;
       }
      } else {
       $$1396$ph = $181;$$1400$ph = $180;
      }
      $$1396 = $$1396$ph;$$1400 = $$1400$ph;
      while(1) {
       $185 = ((($$1396)) + 20|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($186|0)==(0|0);
       if ($187) {
        $188 = ((($$1396)) + 16|0);
        $189 = HEAP32[$188>>2]|0;
        $190 = ($189|0)==(0|0);
        if ($190) {
         break;
        } else {
         $$1396$be = $189;$$1400$be = $188;
        }
       } else {
        $$1396$be = $186;$$1400$be = $185;
       }
       $$1396 = $$1396$be;$$1400 = $$1400$be;
      }
      $191 = HEAP32[(1200)>>2]|0;
      $192 = ($191>>>0)>($$1400>>>0);
      if ($192) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1400>>2] = 0;
       $$3398 = $$1396;
       break;
      }
     } else {
      $169 = ((($10)) + 8|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = HEAP32[(1200)>>2]|0;
      $172 = ($171>>>0)>($170>>>0);
      if ($172) {
       _abort();
       // unreachable;
      }
      $173 = ((($170)) + 12|0);
      $174 = HEAP32[$173>>2]|0;
      $175 = ($174|0)==($10|0);
      if (!($175)) {
       _abort();
       // unreachable;
      }
      $176 = ((($167)) + 8|0);
      $177 = HEAP32[$176>>2]|0;
      $178 = ($177|0)==($10|0);
      if ($178) {
       HEAP32[$173>>2] = $167;
       HEAP32[$176>>2] = $170;
       $$3398 = $167;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $193 = ($165|0)==(0|0);
    if (!($193)) {
     $194 = ((($10)) + 28|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = (1488 + ($195<<2)|0);
     $197 = HEAP32[$196>>2]|0;
     $198 = ($197|0)==($10|0);
     do {
      if ($198) {
       HEAP32[$196>>2] = $$3398;
       $cond420 = ($$3398|0)==(0|0);
       if ($cond420) {
        $199 = 1 << $195;
        $200 = $199 ^ -1;
        $201 = HEAP32[(1188)>>2]|0;
        $202 = $201 & $200;
        HEAP32[(1188)>>2] = $202;
        break L111;
       }
      } else {
       $203 = HEAP32[(1200)>>2]|0;
       $204 = ($203>>>0)>($165>>>0);
       if ($204) {
        _abort();
        // unreachable;
       } else {
        $205 = ((($165)) + 16|0);
        $206 = HEAP32[$205>>2]|0;
        $207 = ($206|0)==($10|0);
        $208 = ((($165)) + 20|0);
        $$sink456 = $207 ? $205 : $208;
        HEAP32[$$sink456>>2] = $$3398;
        $209 = ($$3398|0)==(0|0);
        if ($209) {
         break L111;
        } else {
         break;
        }
       }
      }
     } while(0);
     $210 = HEAP32[(1200)>>2]|0;
     $211 = ($210>>>0)>($$3398>>>0);
     if ($211) {
      _abort();
      // unreachable;
     }
     $212 = ((($$3398)) + 24|0);
     HEAP32[$212>>2] = $165;
     $213 = ((($10)) + 16|0);
     $214 = HEAP32[$213>>2]|0;
     $215 = ($214|0)==(0|0);
     do {
      if (!($215)) {
       $216 = ($210>>>0)>($214>>>0);
       if ($216) {
        _abort();
        // unreachable;
       } else {
        $217 = ((($$3398)) + 16|0);
        HEAP32[$217>>2] = $214;
        $218 = ((($214)) + 24|0);
        HEAP32[$218>>2] = $$3398;
        break;
       }
      }
     } while(0);
     $219 = ((($213)) + 4|0);
     $220 = HEAP32[$219>>2]|0;
     $221 = ($220|0)==(0|0);
     if (!($221)) {
      $222 = HEAP32[(1200)>>2]|0;
      $223 = ($222>>>0)>($220>>>0);
      if ($223) {
       _abort();
       // unreachable;
      } else {
       $224 = ((($$3398)) + 20|0);
       HEAP32[$224>>2] = $220;
       $225 = ((($220)) + 24|0);
       HEAP32[$225>>2] = $$3398;
       break;
      }
     }
    }
   }
  } while(0);
  $226 = $137 | 1;
  $227 = ((($$1)) + 4|0);
  HEAP32[$227>>2] = $226;
  $228 = (($114) + ($137)|0);
  HEAP32[$228>>2] = $137;
  $229 = HEAP32[(1204)>>2]|0;
  $230 = ($$1|0)==($229|0);
  if ($230) {
   HEAP32[(1192)>>2] = $137;
   return;
  } else {
   $$2 = $137;
  }
 } else {
  $231 = $116 & -2;
  HEAP32[$115>>2] = $231;
  $232 = $$1380 | 1;
  $233 = ((($$1)) + 4|0);
  HEAP32[$233>>2] = $232;
  $234 = (($114) + ($$1380)|0);
  HEAP32[$234>>2] = $$1380;
  $$2 = $$1380;
 }
 $235 = $$2 >>> 3;
 $236 = ($$2>>>0)<(256);
 if ($236) {
  $237 = $235 << 1;
  $238 = (1224 + ($237<<2)|0);
  $239 = HEAP32[296]|0;
  $240 = 1 << $235;
  $241 = $239 & $240;
  $242 = ($241|0)==(0);
  if ($242) {
   $243 = $239 | $240;
   HEAP32[296] = $243;
   $$pre = ((($238)) + 8|0);
   $$0401 = $238;$$pre$phiZ2D = $$pre;
  } else {
   $244 = ((($238)) + 8|0);
   $245 = HEAP32[$244>>2]|0;
   $246 = HEAP32[(1200)>>2]|0;
   $247 = ($246>>>0)>($245>>>0);
   if ($247) {
    _abort();
    // unreachable;
   } else {
    $$0401 = $245;$$pre$phiZ2D = $244;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $248 = ((($$0401)) + 12|0);
  HEAP32[$248>>2] = $$1;
  $249 = ((($$1)) + 8|0);
  HEAP32[$249>>2] = $$0401;
  $250 = ((($$1)) + 12|0);
  HEAP32[$250>>2] = $238;
  return;
 }
 $251 = $$2 >>> 8;
 $252 = ($251|0)==(0);
 if ($252) {
  $$0394 = 0;
 } else {
  $253 = ($$2>>>0)>(16777215);
  if ($253) {
   $$0394 = 31;
  } else {
   $254 = (($251) + 1048320)|0;
   $255 = $254 >>> 16;
   $256 = $255 & 8;
   $257 = $251 << $256;
   $258 = (($257) + 520192)|0;
   $259 = $258 >>> 16;
   $260 = $259 & 4;
   $261 = $260 | $256;
   $262 = $257 << $260;
   $263 = (($262) + 245760)|0;
   $264 = $263 >>> 16;
   $265 = $264 & 2;
   $266 = $261 | $265;
   $267 = (14 - ($266))|0;
   $268 = $262 << $265;
   $269 = $268 >>> 15;
   $270 = (($267) + ($269))|0;
   $271 = $270 << 1;
   $272 = (($270) + 7)|0;
   $273 = $$2 >>> $272;
   $274 = $273 & 1;
   $275 = $274 | $271;
   $$0394 = $275;
  }
 }
 $276 = (1488 + ($$0394<<2)|0);
 $277 = ((($$1)) + 28|0);
 HEAP32[$277>>2] = $$0394;
 $278 = ((($$1)) + 16|0);
 $279 = ((($$1)) + 20|0);
 HEAP32[$279>>2] = 0;
 HEAP32[$278>>2] = 0;
 $280 = HEAP32[(1188)>>2]|0;
 $281 = 1 << $$0394;
 $282 = $280 & $281;
 $283 = ($282|0)==(0);
 L197: do {
  if ($283) {
   $284 = $280 | $281;
   HEAP32[(1188)>>2] = $284;
   HEAP32[$276>>2] = $$1;
   $285 = ((($$1)) + 24|0);
   HEAP32[$285>>2] = $276;
   $286 = ((($$1)) + 12|0);
   HEAP32[$286>>2] = $$1;
   $287 = ((($$1)) + 8|0);
   HEAP32[$287>>2] = $$1;
  } else {
   $288 = HEAP32[$276>>2]|0;
   $289 = ((($288)) + 4|0);
   $290 = HEAP32[$289>>2]|0;
   $291 = $290 & -8;
   $292 = ($291|0)==($$2|0);
   L200: do {
    if ($292) {
     $$0382$lcssa = $288;
    } else {
     $293 = ($$0394|0)==(31);
     $294 = $$0394 >>> 1;
     $295 = (25 - ($294))|0;
     $296 = $293 ? 0 : $295;
     $297 = $$2 << $296;
     $$0381438 = $297;$$0382437 = $288;
     while(1) {
      $304 = $$0381438 >>> 31;
      $305 = (((($$0382437)) + 16|0) + ($304<<2)|0);
      $300 = HEAP32[$305>>2]|0;
      $306 = ($300|0)==(0|0);
      if ($306) {
       break;
      }
      $298 = $$0381438 << 1;
      $299 = ((($300)) + 4|0);
      $301 = HEAP32[$299>>2]|0;
      $302 = $301 & -8;
      $303 = ($302|0)==($$2|0);
      if ($303) {
       $$0382$lcssa = $300;
       break L200;
      } else {
       $$0381438 = $298;$$0382437 = $300;
      }
     }
     $307 = HEAP32[(1200)>>2]|0;
     $308 = ($307>>>0)>($305>>>0);
     if ($308) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$305>>2] = $$1;
      $309 = ((($$1)) + 24|0);
      HEAP32[$309>>2] = $$0382437;
      $310 = ((($$1)) + 12|0);
      HEAP32[$310>>2] = $$1;
      $311 = ((($$1)) + 8|0);
      HEAP32[$311>>2] = $$1;
      break L197;
     }
    }
   } while(0);
   $312 = ((($$0382$lcssa)) + 8|0);
   $313 = HEAP32[$312>>2]|0;
   $314 = HEAP32[(1200)>>2]|0;
   $315 = ($314>>>0)<=($$0382$lcssa>>>0);
   $316 = ($314>>>0)<=($313>>>0);
   $317 = $316 & $315;
   if ($317) {
    $318 = ((($313)) + 12|0);
    HEAP32[$318>>2] = $$1;
    HEAP32[$312>>2] = $$1;
    $319 = ((($$1)) + 8|0);
    HEAP32[$319>>2] = $313;
    $320 = ((($$1)) + 12|0);
    HEAP32[$320>>2] = $$0382$lcssa;
    $321 = ((($$1)) + 24|0);
    HEAP32[$321>>2] = 0;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $322 = HEAP32[(1216)>>2]|0;
 $323 = (($322) + -1)|0;
 HEAP32[(1216)>>2] = $323;
 $324 = ($323|0)==(0);
 if (!($324)) {
  return;
 }
 $$0211$in$i = (1640);
 while(1) {
  $$0211$i = HEAP32[$$0211$in$i>>2]|0;
  $325 = ($$0211$i|0)==(0|0);
  $326 = ((($$0211$i)) + 8|0);
  if ($325) {
   break;
  } else {
   $$0211$in$i = $326;
  }
 }
 HEAP32[(1216)>>2] = -1;
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 32|0;
 $vararg_buffer = sp + 16|0;
 $3 = sp;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$27 = $17;
   while(1) {
    $26 = ($27|0)<(0);
    if ($26) {
     break;
    }
    $35 = (($$04855) - ($27))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($27>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($27) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$27 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1680|0);
}
function _dummy($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 4;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1;
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((1684|0));
 return (1692|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((1684|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[35]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[35]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $26 = $17;
     } else {
      $26 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $25 = ($26|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 7]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function ___emscripten_environ_constructor() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___buildEnvironment((1696|0));
 return;
}
function __get_environ() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1696|0);
}
function _llvm_round_f64(d) {
    d = +d;
    return d >= +0 ? +Math_floor(d + +0.5) : +Math_ceil(d - +0.5);
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >= 8192) {
      _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
      return dest|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      block_aligned_end = (aligned_end - 64)|0;

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory(newDynamicTop|0)|0;
      ___setErrNo(12);
      return -1;
    }

    totalMemory = _emscripten_get_heap_size()|0;
    if ((newDynamicTop|0) <= (totalMemory|0)) {
      HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop|0;
    } else {
      if ((_emscripten_resize_heap(newDynamicTop|0)|0) == 0) {
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,___stdio_write,b1,b1,b1];

  return { ___emscripten_environ_constructor: ___emscripten_environ_constructor, ___errno_location: ___errno_location, __get_environ: __get_environ, _fflush: _fflush, _free: _free, _llvm_round_f64: _llvm_round_f64, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, _slib_combi: _slib_combi, _slib_d2dn: _slib_d2dn, _slib_deg2rad: _slib_deg2rad, _slib_eular: _slib_eular, _slib_factorial: _slib_factorial, _slib_gcf: _slib_gcf, _slib_h2hms: _slib_h2hms, _slib_hms2h: _slib_hms2h, _slib_ispn: _slib_ispn, _slib_isrp: _slib_isrp, _slib_jd2tm: _slib_jd2tm, _slib_lcm: _slib_lcm, _slib_permu: _slib_permu, _slib_pnlst: _slib_pnlst, _slib_rad2deg: _slib_rad2deg, _slib_sf_sunrise: _slib_sf_sunrise, _slib_sun_decl_by_date: _slib_sun_decl_by_date, _slib_tm2jd: _slib_tm2jd, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, establishStackSpace: establishStackSpace, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

var real____emscripten_environ_constructor = asm["___emscripten_environ_constructor"]; asm["___emscripten_environ_constructor"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____emscripten_environ_constructor.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real___get_environ = asm["__get_environ"]; asm["__get_environ"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___get_environ.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__llvm_round_f64 = asm["_llvm_round_f64"]; asm["_llvm_round_f64"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_round_f64.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real__slib_combi = asm["_slib_combi"]; asm["_slib_combi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_combi.apply(null, arguments);
};

var real__slib_d2dn = asm["_slib_d2dn"]; asm["_slib_d2dn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_d2dn.apply(null, arguments);
};

var real__slib_deg2rad = asm["_slib_deg2rad"]; asm["_slib_deg2rad"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_deg2rad.apply(null, arguments);
};

var real__slib_eular = asm["_slib_eular"]; asm["_slib_eular"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_eular.apply(null, arguments);
};

var real__slib_factorial = asm["_slib_factorial"]; asm["_slib_factorial"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_factorial.apply(null, arguments);
};

var real__slib_gcf = asm["_slib_gcf"]; asm["_slib_gcf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_gcf.apply(null, arguments);
};

var real__slib_h2hms = asm["_slib_h2hms"]; asm["_slib_h2hms"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_h2hms.apply(null, arguments);
};

var real__slib_hms2h = asm["_slib_hms2h"]; asm["_slib_hms2h"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_hms2h.apply(null, arguments);
};

var real__slib_ispn = asm["_slib_ispn"]; asm["_slib_ispn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_ispn.apply(null, arguments);
};

var real__slib_isrp = asm["_slib_isrp"]; asm["_slib_isrp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_isrp.apply(null, arguments);
};

var real__slib_jd2tm = asm["_slib_jd2tm"]; asm["_slib_jd2tm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_jd2tm.apply(null, arguments);
};

var real__slib_lcm = asm["_slib_lcm"]; asm["_slib_lcm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_lcm.apply(null, arguments);
};

var real__slib_permu = asm["_slib_permu"]; asm["_slib_permu"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_permu.apply(null, arguments);
};

var real__slib_pnlst = asm["_slib_pnlst"]; asm["_slib_pnlst"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_pnlst.apply(null, arguments);
};

var real__slib_rad2deg = asm["_slib_rad2deg"]; asm["_slib_rad2deg"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_rad2deg.apply(null, arguments);
};

var real__slib_sf_sunrise = asm["_slib_sf_sunrise"]; asm["_slib_sf_sunrise"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_sf_sunrise.apply(null, arguments);
};

var real__slib_sun_decl_by_date = asm["_slib_sun_decl_by_date"]; asm["_slib_sun_decl_by_date"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_sun_decl_by_date.apply(null, arguments);
};

var real__slib_tm2jd = asm["_slib_tm2jd"]; asm["_slib_tm2jd"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__slib_tm2jd.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = asm["___emscripten_environ_constructor"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var __get_environ = Module["__get_environ"] = asm["__get_environ"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _llvm_round_f64 = Module["_llvm_round_f64"] = asm["_llvm_round_f64"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _slib_combi = Module["_slib_combi"] = asm["_slib_combi"];
var _slib_d2dn = Module["_slib_d2dn"] = asm["_slib_d2dn"];
var _slib_deg2rad = Module["_slib_deg2rad"] = asm["_slib_deg2rad"];
var _slib_eular = Module["_slib_eular"] = asm["_slib_eular"];
var _slib_factorial = Module["_slib_factorial"] = asm["_slib_factorial"];
var _slib_gcf = Module["_slib_gcf"] = asm["_slib_gcf"];
var _slib_h2hms = Module["_slib_h2hms"] = asm["_slib_h2hms"];
var _slib_hms2h = Module["_slib_hms2h"] = asm["_slib_hms2h"];
var _slib_ispn = Module["_slib_ispn"] = asm["_slib_ispn"];
var _slib_isrp = Module["_slib_isrp"] = asm["_slib_isrp"];
var _slib_jd2tm = Module["_slib_jd2tm"] = asm["_slib_jd2tm"];
var _slib_lcm = Module["_slib_lcm"] = asm["_slib_lcm"];
var _slib_permu = Module["_slib_permu"] = asm["_slib_permu"];
var _slib_pnlst = Module["_slib_pnlst"] = asm["_slib_pnlst"];
var _slib_rad2deg = Module["_slib_rad2deg"] = asm["_slib_rad2deg"];
var _slib_sf_sunrise = Module["_slib_sf_sunrise"] = asm["_slib_sf_sunrise"];
var _slib_sun_decl_by_date = Module["_slib_sun_decl_by_date"] = asm["_slib_sun_decl_by_date"];
var _slib_tm2jd = Module["_slib_tm2jd"] = asm["_slib_tm2jd"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["cwrap"] = cwrap;
Module["setValue"] = setValue;
Module["getValue"] = getValue;
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["ENV"]) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getTempRet0"]) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setTempRet0"]) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    memoryInitializer = locateFile(memoryInitializer);
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    var doBrowserLoad = function() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
    if (memoryInitializerBytes) {
      applyMemoryInitializer(memoryInitializerBytes.buffer);
    } else
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      var useRequest = function() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
          var data = tryParseAsDataURI(Module['memoryInitializerRequestURL']);
          if (data) {
            response = data.buffer;
          } else {
            // If you see this warning, the issue may be that you are using locateFile and defining it in JS. That
            // means that the HTML file doesn't know about it, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
          }
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


  Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}



module.exports=Module;
