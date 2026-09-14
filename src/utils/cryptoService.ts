import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from "node:crypto";
import { customType } from "drizzle-orm/pg-core";

const algorithm = "aes-256-gcm";

const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
    console.error("ENCRYPTION_KEY environment variable is not set");
    throw new Error("ENCRYPTION_KEY environment variable is not set");
}

const key = Buffer.from(encryptionKey, "base64");

if (key.length !== 32) {
    console.error(`ENCRYPTION_KEY must be exactly 32 bytes, but got ${key.length} bytes`);
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes");
}

export function encrypt(value: string): string {
    const iv = randomBytes(12);

    const cipher = createCipheriv(algorithm, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted.toString("base64"),
    ].join(".");
}

export function decrypt(value: string): string {
    const [ivBase64, authTagBase64, encryptedBase64] = value.split(".");

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    const decipher = createDecipheriv(algorithm, key, iv);

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}

export const encryptedText = customType<{
    data: string;
    driverData: string;
}>({
    dataType() {
        return "text";
    },

    toDriver(value) {
        return encrypt(value);
    },

    fromDriver(value) {
        return decrypt(value);
    },
});