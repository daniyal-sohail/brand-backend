const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const uploadToCloudinary = async (filePath, folder = 'Brand-appeal') => {
  console.log(`Uploading file to Cloudinary: ${filePath}`);
  return await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'auto'
  });
};

// Upload a Buffer using upload_stream (for serverless/memory uploads)
const uploadBufferToCloudinary = (buffer, folder = 'Brand-appeal', mimetype = 'application/octet-stream') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    // Write buffer to the stream
    stream.end(buffer);
  });
};
const deleteFromCloudinary = async (publicId, resource_type = 'image') => {
  const fullPublicId = `Brand-appeal/${publicId}`;
  console.log(`Deleting file from Cloudinary: ${fullPublicId} of type ${resource_type}`);
  const result = await cloudinary.uploader.destroy(fullPublicId, { resource_type });
  console.log(`Delete result: ${JSON.stringify(result)}`);
};
module.exports = { uploadToCloudinary, uploadBufferToCloudinary, deleteFromCloudinary };