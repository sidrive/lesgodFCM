/**
 * Agus Setiwan <agus@lesgood.com>
 * 11 May 2017
 */

'use stricts'
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const rp = require('request-promise');
const promisePool = require('es6-promise-pool');
const PromisePool = promisePool.PromisePool;
const secureCompare = require('secure-compare');


// LIBS CONSTANT LIST
// -------------------
const generateThumbnail   	= require('./libs/images');
const guruIndexing			= require('./libs/gurus');
// const deleteOldOrders		= require('./libs/orders')



// EXPORT ALL FUNCTIONS
// -------------------
exports.generateThumbnail   	= functions.storage.object().onChange(generateThumbnail);
// exports.guruIndexing     		= functions.database.ref('/user-skills/{uid}/{code}').onWrite(guruIndexing);
// exports.deleteOldOrders 		= functions.https.onRequest(deleteOldOrders);


// Cut off time. Child nodes older than this will be deleted.
const CUT_OFF_TIME = 2 * 60 * 60 * 1000; // 2 Hours in milliseconds.

/**
 * This database triggered function will check for child nodes that are older than the
 * cut-off time. Each child needs to have a `timestamp` attribute.
 */
exports.deleteOldOrders = functions.https.onRequest((req, res) => {
  
     const key = req.query.key;

  // Exit if the keys don't match
  if (!secureCompare(key, functions.config().cron.key)) {
    console.log('The key provided in the request does not match the key set in the environment. Check that', key,
        'matches the cron.key attribute in `firebase env:get`');
    res.status(403).send('Security key does not match. Make sure your "key" URL query parameter matches the ' +
        'cron.key environment variable.');
    return;
  }
  /*const ref = admin.database().ref();*/
  const now = Date.now();
  const cutoff = now - CUT_OFF_TIME;
  
  
      let order, orders = [];
      let oldItemsQuery = admin.database().ref('/orders').orderByChild('ordertime').endAt(cutoff);
      oldItemsQuery.once('value').then(snapshot => {
        // create a map with all children that need to be removed
        
        snapshot.forEach((childSnapshot) => {
          order = childSnapshot.val();
          orders.push(order);
        });
        console.log(orders.length + " users retrieved");
        // Delete users then wipe the database

      if (orders.length > 0) {
        // Now map users to an Array of Promises
        console.log("Checking status users... ");
        let promises = orders.map(order => deleteOrder(order));

        // Wait for all Promises to complete before wiping db
        Promise.all(promises)
            .catch( e => console.log(e.message) );
    } if (orders.length == 0 ){
      res.end('finish');
    }    
  }).then(()=>{
          res.send('finish')
        }).catch(error =>{
          res.send('error')
        })
 });

  function deleteOrder(order) {
    if (order.status == 'pending_guru'){
        return new Promise((resolve, reject) => {
            console.log("Delete user: " + order.oid + "");
            admin.database().ref('/orders/'+order.oid).remove()
            .then( () => {
                    console.log(order.oid + " deleted.");
                    resolve(order);
                })
                .catch( e => {
                    console.log([e.message, order.oid, "could not be deleted!"].join(' '));
                    resolve(order);
                });
        });
      } console.log("Status users is approved... ");
      console.log("Users could not be deleted ");
    }



// Keeps track of the length of the 'skill' child list in a separate property.
exports.countSkillchange = functions.database.ref('user-skills/{uid}/{code}').onWrite(event => {
  const collectionRef = event.data.adminRef.root;
  const uid    = event.params.uid;
  const countRef = collectionRef.child('users/'+uid+'/totalSkill');

  // Return the promise from countRef.transaction() so our function 
  // waits for this async event to complete before it exits.
  return countRef.transaction(current => {
    if (event.data.exists() && !event.data.previous.exists()) {
      return (current || 0) + 1;
    }
    else if (!event.data.exists() && event.data.previous.exists()) {
      return (current || 0) - 1;
    }
  }).then(() => {
    console.log('Total Skill updated.');
  });
});