import busboy from 'busboy';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONFIG } from '../config.js';
import { verifyCsrf } from '../security/guards.js';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit

export function handleFileUpload(req, res) {
  // CSRF validation
  if (!verifyCsrf(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: Invalid or missing CSRF token', success: false }));
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content-Type must be multipart/form-data', success: false }));
    return;
  }

  // Ensure uploads directory exists
  if (!fs.existsSync(CONFIG.UPLOADS_DIR)) {
    fs.mkdirSync(CONFIG.UPLOADS_DIR, { recursive: true });
  }

  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 10
    }
  });

  const uploadedFiles = [];
  let fileError = null;
  let pendingWrites = 0;
  let isFinished = false;

  const maybeSendResponse = () => {
    if (isFinished && pendingWrites === 0) {
      if (fileError) {
        res.writeHead(fileError.status || 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: fileError.message, success: false }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          filePath: uploadedFiles[0]?.filePath || null,
          fileName: uploadedFiles[0]?.fileName || null,
          size: uploadedFiles[0]?.size || 0,
          files: uploadedFiles
        }));
      }
    }
  };

  bb.on('file', (name, fileStream, info) => {
    const originalName = info.filename || 'uploaded_file';
    // Sanitize filename to prevent path traversal
    const safeBase = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const uniqueName = `${uniquePrefix}-${safeBase}`;
    const destPath = path.resolve(CONFIG.UPLOADS_DIR, uniqueName);

    // Verify destPath stays strictly within CONFIG.UPLOADS_DIR
    const uploadsRoot = path.resolve(CONFIG.UPLOADS_DIR);
    if (destPath !== uploadsRoot && !destPath.startsWith(uploadsRoot + path.sep)) {
      fileError = { message: 'Invalid file path traversal detected', status: 400 };
      fileStream.resume();
      return;
    }

    pendingWrites++;
    const writeStream = fs.createWriteStream(destPath);
    let bytesWritten = 0;

    fileStream.on('data', chunk => {
      bytesWritten += chunk.length;
    });

    fileStream.on('limit', () => {
      fileError = { message: `File exceeds maximum allowed size of 15MB: ${originalName}`, status: 413 };
      writeStream.destroy();
      try { fs.unlinkSync(destPath); } catch {}
    });

    fileStream.pipe(writeStream);

    writeStream.on('finish', () => {
      pendingWrites--;
      if (!fileError) {
        uploadedFiles.push({
          fileName: originalName,
          filePath: destPath,
          size: bytesWritten
        });
      }
      maybeSendResponse();
    });

    writeStream.on('error', (err) => {
      pendingWrites--;
      fileError = { message: `Failed to save file: ${err.message}`, status: 500 };
      try { fs.unlinkSync(destPath); } catch {}
      maybeSendResponse();
    });
  });

  bb.on('error', (err) => {
    fileError = { message: `Upload error: ${err.message}`, status: 400 };
    maybeSendResponse();
  });

  bb.on('finish', () => {
    isFinished = true;
    maybeSendResponse();
  });

  req.pipe(bb);
}
