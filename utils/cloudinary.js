const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (file, folder = 'Brand-appeal') => {
  console.log(`Uploading file to Cloudinary: ${typeof file === 'string' ? file : 'Buffer'}`);

  // Handle both file paths (string) and memory buffers (Buffer)
  if (typeof file === 'string') {
    // File path upload (for local development)
    return await cloudinary.uploader.upload(file, {
      folder,
      resource_type: 'auto'
    });
  } else if (file.buffer) {
    // Memory buffer upload (for serverless environments)
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        folder,
        resource_type: 'auto'
      }, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      });

      uploadStream.end(file.buffer);
    });
  } else {
    throw new Error('Invalid file format. Expected file path or buffer.');
  }
};

const deleteFromCloudinary = async (publicId, resource_type = 'image') => {
  const fullPublicId = `Brand-appeal/${publicId}`;
  console.log(`Deleting file from Cloudinary: ${fullPublicId} of type ${resource_type}`);
  const result = await cloudinary.uploader.destroy(fullPublicId, { resource_type });
  console.log(`Delete result: ${JSON.stringify(result)}`);
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };