emcc helper.c -o utils/helper.js -g --memory-init-file 0 -s ENVIRONMENT=shell -s WASM=0 -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue']" -s EXPORTED_FUNCTIONS="['_malloc','_free','_derefDouble','_derefInt','_derefTm','_wrap_h2hms','_newInt','_newTm']"
echo 'module.exports=Module;' >>utils/helper.js
