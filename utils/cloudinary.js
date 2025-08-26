const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const uploadToCloudinary = async (filePath, folder = 'Brand-appeal') => {
  console.log(`Uploading file to Cloudinary: ${filePath}`);
  // console.log(`${filePath.split('/').pop().split('.')[0]}`);
  // console.log(`${filePath}`);
  return await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'auto'
  });
};
const deleteFromCloudinary = async (publicId, resource_type = 'image') => {
  const fullPublicId = `Brand-appeal/${publicId}`;
  console.log(`Deleting file from Cloudinary: ${fullPublicId} of type ${resource_type}`);
  const result = await cloudinary.uploader.destroy(fullPublicId, { resource_type });
  console.log(`Delete result: ${JSON.stringify(result)}`);
};
module.exports = { uploadToCloudinary, deleteFromCloudinary };