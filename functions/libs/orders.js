/**
 * Agus Setiwan <agus@ontelstudio.com>
 * 20 April 2017
 */
'use stricts'

const admin         = require('firebase-admin');
const functions 	= require('firebase-functions'); 
const nodemailer    = require('nodemailer');

// Initializing Admin
// --------------------------------
admin.initializeApp(functions.config().firebase);

const gmailEmail = encodeURIComponent(functions.config().gmail.email);
const gmailPassword = encodeURIComponent(functions.config().gmail.password);
const mailTransport = nodemailer.createTransport(
    `smtps://${gmailEmail}:${gmailPassword}@smtp.gmail.com`);

function ordering(event){
	// Only edit data when it is first created.

	 // Exit when the data is deleted.
    if (!event.data.exists()) {
  		return;
    }

	const eventVal 	= event.data.val();
    const oid      	= event.params.oid;
    const title    	= eventVal.title;
    const status  	= eventVal.status;
    const gid 		= eventVal.gid;
    const uid 		= eventVal.uid;

    const rootRef   = event.data.adminRef.root;

    let subject = "Kamu memiliki pesanan baru"
    let message = "Order #"+oid;
    let text    = "Hey, kamu memiliki order baru dengan order id #"+oid+". Silakan cek aplikasi Lesgood Pengajar mu untuk melihat detail order";

    if (status == "waiting") {
    	sendMessage(subject, gid, message, "gurus", oid);
    	// sendEmailNotification(subject, gid, text);
    }

    if (status == "pending") {
    	let subject = "Pesananmu telah diterima oleh guru"
    	let message = "Order #"+oid+", lanjutkan ke pembayaran";

    	sendMessage(subject, gid, message, "users", oid);
    }

    if (status == "success") {

        subject = "Pesananmu telah dibayar"
        message = "Order #"+oid;

        text    = "Hey, ordermu dengan order id #"+oid+" telah dibayar. Silakan cek aplikasi Lesgood Guru mu untuk melihat detail order";

        sendMessage(subject, gid, message, "gurus", oid);
    	// sendEmailNotification(subject, gid, text);

    	// generateSchedule(pertemuan, gid, uid, rootRef);
    }

    if (status == "cancel") {

    }

}

function sendEmailNotification(subject, gid, text){

    const getPartnerEmail = admin.database().ref(`/users/${gid}/email`).once('value');


    return Promise.all([getPartnerEmail]).then(results => {
        const tokensSnapshot = results[0];
        const email = tokensSnapshot.val();

        if (!email) {
            return console.log('There are no email to send to.');
        }


        const mailOptions = {
        from: '"Lokal101" <agus@Lesgood.com>',
        to: email
        };

        mailOptions.subject = subject;
        mailOptions.text = text;
        

        return mailTransport.sendMail(mailOptions).then(() => {
            console.log('New order email sent to:', email);
        });

    });
}


function sendMessage(subject, reciverUid, message, actor, oid){
    console.log('send notification for user:', reciverUid);

    // Get the list of device notification tokens.

    let path = `/users/${reciverUid}/userTokens`;
    if (actor === "gurus") {
    	let path = `/users/${reciverUid}/guruTokens`;
    }
    const getDeviceTokensPromise = admin.database().ref(path).once('value');


    return Promise.all([getDeviceTokensPromise]).then(results => {
        const tokensSnapshot = results[0];

        // Check if there are any device tokens.
        if (!tokensSnapshot.hasChildren()) {
            return console.log('There are no notification tokens to send to.');
        }
        console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
    

        // Notification details.
        const payload = {
            notification: {
                title: subject,
                body: message,
                tag: oid
            }
        };

        // Listing all tokens.
        const tokens = Object.keys(tokensSnapshot.val());

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
                        tokensToRemove.push(event.data.ref.remove())
                    }
                }
            });
          return Promise.all(tokensToRemove);
        });
    });
}


function generateSchedule(pertemuan, gid, uid, rootRef){
    rootRef.child("user-schedules").child(gid).update(pertemuan);
    rootRef.child("user-schedules").child(uid).update(pertemuan);
}

module.exports = ordering

