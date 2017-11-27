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
const generateThumbnail     = require('./libs/images');
const guruIndexing      = require('./libs/gurus');
// const deleteOldOrders    = require('./libs/orders')



// EXPORT ALL FUNCTIONS
// -------------------
exports.generateThumbnail     = functions.storage.object().onChange(generateThumbnail);
exports.guruIndexing        = functions.database.ref('/user-skills/{uid}/{code}').onWrite(guruIndexing);
// exports.deleteOldOrders    = functions.https.onRequest(deleteOldOrders);


// Cut off time. Child nodes older than this will be deleted.
const CUT_OFF_TIME = 24 * 60 * 60 * 1000; // 2 Hours in milliseconds.

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


//
exports.countReviewsChange = functions.database.ref('user-reviews/{uid}/reviews/{code}').onWrite(event => {
  const collectionRef = event.data.adminRef.root;
  const uid    = event.params.uid;
  const countRef = collectionRef.child('users/'+uid+'/review');

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
    console.log('Total Reviews updated.');
  });
});
//
///
// End of Functions to track sum of reviews


// Functions update total of reviews
///
//
exports.recountReviews = functions.database.ref('users/{uid}/review').onWrite(event => {
  
  const collectionRef = event.data.adminRef.root;
  const uid    = event.params.uid;
  const countRef = collectionRef.child('users/'+uid+'/review');
  const cRef = collectionRef.child('user-reviews/'+uid+'/reviews');

  return cRef.once('value')
        .then(messagesData => countRef.set(messagesData.numChildren()))
        .then(() => {
    console.log('Total Reviews updated');
  });
});
//
///
// End of Functions update total of reviews


// Functions update total of reviews
///
//
exports.recountSkill = functions.database.ref('users/{uid}/totalSkill').onWrite(event => {
  
  const collectionRef = event.data.adminRef.root;
  const uid    = event.params.uid;
  const countRef = collectionRef.child('users/'+uid+'/totalSkill');
  const cRef = collectionRef.child('user-skills/'+uid);

  return cRef.once('value')
        .then(messagesData => countRef.set(messagesData.numChildren())).then(() => {
    console.log('Total Skill updated');
  });
  
});
//
///
// End of Functions update total of reviews


// Functions Push Notification Order
///
//
   
exports.sendOrderNotification = functions.database.ref('orders/{Oid}/status').onWrite(event => {
  const Oid = event.params.Oid;

  let order, orders = [];
      const oldItemsQuery = admin.database().ref('/orders/').orderByChild('oid').equalTo(Oid);
      oldItemsQuery.once('value').then(snapshot => {
        // create a map with all children that need to be removed
        
        snapshot.forEach((childSnapshot) => {
          order = childSnapshot.val();
          orders.push(order);
        });
        console.log(orders.length + " order retrieved");
        console.log("Order title : "+order.title);
        // Delete users then wipe the database

        let promises = orders.map(order => sendNotification(order));
        Promise.all(promises)
            .catch( e => console.log(e.message) );
        
  });

 });   
   
function sendNotification(order) {

  const guruID = order.gid;
    const userID = order.uid;
    const orderID = order.oid;

    if (order.status == 'pending_guru'){

      // Get the list of device notification tokens.
      const getGuruTokensPromise = admin.database().ref(`users/${guruID}/guruTokens`).once('value');

      // Get the Siswa profile.
      const getSiswaProfilePromise = admin.auth().getUser(userID);

      return Promise.all([getGuruTokensPromise, getSiswaProfilePromise]).then(results => {
      const tokensSnapshot = results[0];
      const siswa = results[1];
      const titleNotifications = 'Lessgood : Penawaran Mengajar!';

    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched siswa profile', siswa);

    // Notification details.
    const payload = {
      notification: {
        title: titleNotifications,
        body: `${siswa.displayName} ingin menjadi murid Anda. Silahkan konfirmasi paling lambat 2 jam`,
        icon: siswa.photoURL
      }
    };

    // Listing all tokens.
    const tokens = Object.keys(tokensSnapshot.val());

    send(tokens,payload);
  });

    }if (order.status == 'pending_murid'){

    /*if (!event.data.val()) {
    return console.log('User ', orderID, 'un-followed user', userID);
    }
    console.log('We have a new follower UID:', userID, 'for user:', guruID);*/

  // Get the list of device notification tokens.
  
  const getMuridTokensPromise = admin.database().ref(`users/${userID}/userTokens`).once('value');
  
  // Get the follower profile.
  const getGuruProfilePromise = admin.auth().getUser(guruID);

  return Promise.all([getMuridTokensPromise, getGuruProfilePromise]).then(results => {
    const tokensSnapshot = results[0];
    const guru = results[1];

    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched guru profile', guru);

    // Notification details.
    const payload = {
      notification: {
        title: 'Lessgood : Pengajar bersedia Mengajar',
        body: `${guru.displayName} akan menjadi guru Anda. Silahkan melakukan pembayaran paling lambat 1x24 jam`,
        icon: guru.photoURL
      }
    };

    // Listing all tokens.
    const tokens = Object.keys(tokensSnapshot.val());
    send(tokens,payload)
    
  });
}if (order.status == 'SUCCESS'){

    
  sendMurid(order);
  sendGuru(order);
  

///////////////////////////

}

  function send(tokens,payload){
  // Send notifications to all tokens.
    return admin.messaging().sendToDevice(tokens, payload).then(response => {
      // For each message check if there was an error.
      const tokensToRemove = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error('Failure sending notification to', tokens[index], error);
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
          }
        }
      });
      return Promise.all(tokensToRemove);
    });
  }

  function sendMurid(order){
  // Get the list of device notification tokens.
    const getMuridTokensPromise = admin.database().ref(`users/${userID}/userTokens`).once('value');
  
  // Get the follower profile.
  const getGuruProfilePromise = admin.auth().getUser(guruID);
  

  return Promise.all([getMuridTokensPromise, getGuruProfilePromise]).then(results => {
    const tokensSnapshot = results[0];
    const guru = results[1];

    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched guru profile', guru);

    // Notification details.
    const payload = {
      notification: {
        title: 'Lessgood : Pembayaran Berhasil!',
        body: `${guru.displayName} akan menjadi guru Anda.`,
        icon: guru.photoURL
      }
    };

    // Listing all tokens.
    const tokens = Object.keys(tokensSnapshot.val());
    send(tokens,payload)
    
  });
}
  function sendGuru(order){
  const getGuruTokensPromise = admin.database().ref(`users/${guruID}/guruTokens`).once('value');
  const getMuridProfilePromise = admin.auth().getUser(userID);
  return Promise.all([getGuruTokensPromise, getMuridProfilePromise]).then(results => {
    const tokensSnapshot = results[0];
    const siswa = results[1];

    // Check if there are any device tokens.
    if (!tokensSnapshot.hasChildren()) {
      return console.log('There are no notification tokens to send to.');
    }
    console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    console.log('Fetched guru profile', siswa);

    // Notification details.
    const payload = {
      notification: {
        title: 'Lessgood : Persiapan Mengajar',
        body: `${siswa.displayName} akan menjadi murid Anda. Silahkan memperkenalkan diri ke murid dan persiapkan untuk Mengajar`,
        icon: siswa.photoURL
      }
    };

    // Listing all tokens.
    const tokens = Object.keys(tokensSnapshot.val());
    send(tokens,payload)
    
  });
  }
}