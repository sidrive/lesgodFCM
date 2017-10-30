/**
 * Agus Setiwan <agus@ontelstudio.com>
 * 11 May 2017
 *
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 *
 * -------------------------------------------------------- */
'use stricts'
const mkdirp = require('mkdirp-promise');
const gcs    = require('@google-cloud/storage')();
const spawn  = require('child-process-promise').spawn;

const LOCAL_TMP_FOLDER = '/tmp/';
const THUMB_MAX_HEIGHT = 200;
const THUMB_MAX_WIDTH = 200;

const THUMB_PREFIX = 'thumb_';


/**
 *
 * @construction
 *
 * @param `event` Firebase function callback
 */
function generateThumbnail(event) {
    const filePath = event.data.name;
    const filePathSplit = filePath.split('/');
    const fileName = filePathSplit.pop();
    const fileDir = filePathSplit.join('/') + (filePathSplit.length > 0 ? '/' : '');
    const thumbFilePath = `${fileDir}${THUMB_PREFIX}${fileName}`;
    const tempLocalDir = `${LOCAL_TMP_FOLDER}${fileDir}`;
    const tempLocalFile = `${tempLocalDir}${fileName}`;
    const tempLocalThumbFile = `${LOCAL_TMP_FOLDER}${thumbFilePath}`;

    // Exit if this is triggered on a file that is not an image.
    if (!event.data.contentType.startsWith('image/')) {
    console.log('This is not an image.');
        return;
    }

    // Exit if the image is already a thumbnail.
    if (fileName.startsWith(THUMB_PREFIX)) {
    console.log('Already a Thumbnail.');
        return;
    }

    // Exit if this is a move or deletion event.
    if (event.data.resourceState === 'not_exists') {
    console.log('This is a deletion event.');
        return;
    }

    // Create the temp directory where the storage file will be downloaded.
    return mkdirp(tempLocalDir).then(() => {
        // Download file from bucket.
        const bucket = gcs.bucket(event.data.bucket);
        return bucket.file(filePath).download({
            destination: tempLocalFile
        })
        .then(() => {
            console.log('The file has been downloaded to', tempLocalFile);
            // Generate a thumbnail using ImageMagick.
            return spawn('convert', [tempLocalFile, '-thumbnail', `${THUMB_MAX_WIDTH}x${THUMB_MAX_HEIGHT}>`, tempLocalThumbFile])
            .then(() => {
                console.log('Thumbnail created at', tempLocalThumbFile);
                // Uploading the Thumbnail.
                return bucket.upload(tempLocalThumbFile, {
                    destination: thumbFilePath
                }).then(() => {
                    console.log('Thumbnail uploaded to Storage at', thumbFilePath);
                });
            });
        });
    });
}

module.exports = generateThumbnail 