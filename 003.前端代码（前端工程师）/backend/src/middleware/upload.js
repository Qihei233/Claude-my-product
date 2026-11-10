import multer from 'multer';
import { ApiError } from '../utils/http.js';

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith('image/')) {
      return callback(new ApiError(400, '头像只支持图片文件'));
    }
    return callback(null, true);
  },
});
