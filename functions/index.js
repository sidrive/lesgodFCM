/**
 * Agus Setiwan <agus@lesgood.com>
 * 11 May 2017
 */

'use stricts'
const functions = require('firebase-functions');


// LIBS CONSTANT LIST
// -------------------
const generateThumbnail   	= require('./libs/images');
const guruIndexing			= require('./libs/gurus')



// EXPORT ALL FUNCTIONS
// -------------------
exports.generateThumbnail   	= functions.storage.object().onChange(generateThumbnail);
exports.guruIndexing     		= functions.database.ref('/user-skills/{uid}/{code}').onWrite(guruIndexing);

