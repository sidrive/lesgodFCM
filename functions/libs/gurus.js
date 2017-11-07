/**
 * Agus Setiwan <agus@lesgood.com>
 * 11 May 2017
 */

'use stricts'
const admin = require('firebase-admin');

function guruIndexing(event){
	const eventVal 	= event.data.val();
	const code 		= event.params.code;
	const uid 		= event.params.uid;
	
	const rootRef   = event.data.adminRef.root;

	if (event.data.exists()) {
		indexingByCode(uid, code, rootRef);
	}else{
		deleteIndex(uid, code, rootRef);
	}
}

function indexingByCode(uid, code, rootRef){
	rootRef.child('gurus/'+code+'/'+uid).set(true);

	var ref = rootRef.child("users/"+uid+"/totalSkill");
	ref.once("value")
	  	.then(function(snapshot) {
	    	let totalSkill = snapshot.val();
	    	if (totalSkill === null) {
	    		totalSkill = 0;
	    	}

	    	let total = totalSkill+1
	    	ref.set(total);

	    	console.log("totalSkill of "+uid+" updated to "+total);
	});
}

function deleteIndex(uid, code, rootRef){
	rootRef.child('gurus/'+code+'/'+uid).remove();

	var ref = rootRef.child("users/"+uid+"/totalSkill");
	ref.once("value")
	  	.then(function(snapshot) {
	    	let totalSkill = snapshot.val();
	    	if (totalSkill === null) {
	    		totalSkill = 0;
	    		return console.log("current totalSkill is 0");
	    	}

	    	let total = totalSkill-1
	    	ref.set(total);

	    	console.log("totalSkill of "+uid+" updated to "+total);
	});
}

module.exports = guruIndexing