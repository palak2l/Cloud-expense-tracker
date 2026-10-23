const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ALLOWED_RECEIPT_TYPES, ALLOWED_RECEIPT_EXTENSIONS } = require("../utils/constants");

function createStorage() {
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "s3") {
    return new S3Storage();
  }
  return new LocalStorage();
}

function validateReceiptFile(file) {
  const maxBytes = Number(process.env.MAX_RECEIPT_BYTES || 5 * 1024 * 1024);
  if (!file || !file.buffer) {
    return "A receipt file is required.";
  }
  if (file.size > maxBytes) {
    return `Receipt must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_RECEIPT_EXTENSIONS.has(ext)) {
    return "Receipt must be a JPG, PNG, WEBP, or PDF file.";
  }
  if (!ALLOWED_RECEIPT_TYPES.has(file.mimetype)) {
    return "Receipt type is not allowed.";
  }
  return null;
}

function objectKey(userId, originalName) {
  const ext = path.extname(originalName || "").toLowerCase() || ".bin";
  const stamp = new Date().toISOString().slice(0, 10);
  return `receipts/${userId}/${stamp}/${crypto.randomUUID()}${ext}`;
}

class LocalStorage {
  constructor() {
    this.root = path.resolve(process.env.UPLOAD_DIR || "./uploads");
    fs.mkdirSync(this.root, { recursive: true });
  }

  async save(userId, file) {
    const key = objectKey(userId, file.originalname);
    const fullPath = path.join(this.root, key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.buffer);
    return key;
  }

  async delete(key) {
    if (!key) {
      return;
    }
    const fullPath = path.join(this.root, key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async getStream(key) {
    const fullPath = path.join(this.root, key);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.createReadStream(fullPath);
  }

  async getSignedUrl(key) {
    return `/api/receipts/file?key=${encodeURIComponent(key)}`;
  }
}

class S3Storage {
  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME;
    this.region = process.env.AWS_REGION || "ap-south-1";
    if (!this.bucket || this.bucket.includes("REPLACE_WITH")) {
      throw new Error("S3_BUCKET_NAME must be set to your private bucket when STORAGE_DRIVER=s3.");
    }
    this.client = new S3Client({ region: this.region });
  }

  async save(userId, file) {
    const key = objectKey(userId, file.originalname);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: "AES256",
        Metadata: {
          userid: String(userId)
        }
      })
    );
    return key;
  }

  async delete(key) {
    if (!key) {
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }

  async getStream(key) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
    return response.Body;
  }

  async getSignedUrl(key) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      }),
      { expiresIn: 60 }
    );
  }
}

module.exports = { createStorage, validateReceiptFile };
