import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export function s3Storage(config, suppliedClient) {
  const client =
    suppliedClient ||
    new S3Client({
      endpoint: config.R2_ENDPOINT,
      region: config.R2_REGION || "auto",
      forcePathStyle: config.R2_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 },
    });
  const Bucket = config.R2_BUCKET;
  const key = (value) => {
    if (
      typeof value !== "string" ||
      !value ||
      value.includes("..") ||
      value.includes("\\") ||
      value.startsWith("/")
    )
      throw new Error("Invalid storage key.");
    return value;
  };
  return {
    test: () => client.send(new HeadBucketCommand({ Bucket })),
    put: async (Key, value) => {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key(Key),
          Body: Buffer.from(value),
        }),
      );
    },
    get: async (Key) => {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket, Key: key(Key) }),
        );
        const bytes = await result.Body.transformToByteArray();
        return {
          body: bytes,
          size: bytes.byteLength,
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
        };
      } catch (e) {
        if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404)
          return null;
        throw e;
      }
    },
    delete: async (keys) => {
      for (const Key of Array.isArray(keys) ? keys : [keys])
        await client.send(new DeleteObjectCommand({ Bucket, Key: key(Key) }));
    },
    close: () => client.destroy?.(),
  };
}
