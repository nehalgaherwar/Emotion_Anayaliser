const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1'
];

files.forEach(file => {
    const fileUrl = baseUrl + file;
    const dest = path.join(modelsDir, file);
    
    https.get(fileUrl, function(response) {
        if (response.statusCode !== 200) {
            console.error(`Failed to download ${file}: ${response.statusCode}`);
            return;
        }
        const fileStream = fs.createWriteStream(dest);
        response.pipe(fileStream);
        fileStream.on('finish', function() {
            fileStream.close();
            console.log(`Downloaded ${file}`);
        });
    }).on('error', function(err) {
        console.error(`Error downloading ${file}: ${err.message}`);
    });
});
