import crypto from "node:crypto";
import mongoose from "mongoose";

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 256;
const MINIMUM_USERNAME_LENGTH = 2;
const MAXIMUM_USERNAME_LENGTH = 120;
const SCRYPT_KEY_LENGTH = 64;

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: MINIMUM_USERNAME_LENGTH,
      maxlength: MAXIMUM_USERNAME_LENGTH,
      match: /^[a-z0-9._-]+$/i,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

const normalizeUsername = (username) => String(username ?? "").trim().toLowerCase();

export const validateUsername = (username) => {
  const normalized = normalizeUsername(username);
  if (
    normalized.length < MINIMUM_USERNAME_LENGTH ||
    normalized.length > MAXIMUM_USERNAME_LENGTH ||
    !/^[a-z0-9._-]+$/.test(normalized)
  ) {
    throw new Error(
      "Username must contain 2 to 120 letters, numbers, periods, underscores, or hyphens.",
    );
  }

  return normalized;
};

export const validatePassword = (password) => {
  const length = String(password ?? "").length;
  if (length < MINIMUM_PASSWORD_LENGTH || length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `Password must contain between ${MINIMUM_PASSWORD_LENGTH} and ${MAXIMUM_PASSWORD_LENGTH} characters.`,
    );
  }
};

export const hashPassword = (password) => {
  validatePassword(password);
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .scryptSync(String(password), salt, SCRYPT_KEY_LENGTH)
    .toString("base64url");
  return `scrypt$${salt}$${hash}`;
};

export const passwordMatches = (password, storedHash = "") => {
  try {
    if (String(password ?? "").length > MAXIMUM_PASSWORD_LENGTH) return false;
    const [algorithm, salt, expectedHash] = storedHash.split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHash) return false;

    const actual = crypto.scryptSync(String(password ?? ""), salt, SCRYPT_KEY_LENGTH);
    const expected = Buffer.from(expectedHash, "base64url");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
};

export const ensureBootstrapUser = async () => {
  const username = normalizeUsername(process.env.BOOTSTRAP_USERNAME);
  const password = process.env.BOOTSTRAP_PASSWORD;
  const replaceUsername = normalizeUsername(process.env.BOOTSTRAP_REPLACE_USERNAME);
  if (!username && !password) return;
  if (!username || !password) {
    throw new Error(
      "BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD must both be configured.",
    );
  }
  validateUsername(username);
  validatePassword(password);

  const existingUser = await User.findOne({ username });
  if (existingUser) return;

  if (replaceUsername && replaceUsername !== username) {
    validateUsername(replaceUsername);
    const replacementUser = await User.findOne({ username: replaceUsername });
    if (replacementUser) {
      replacementUser.username = username;
      replacementUser.passwordHash = hashPassword(password);
      replacementUser.active = true;
      await replacementUser.save();
      return;
    }
  }

  try {
    await User.create({ username, passwordHash: hashPassword(password) });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
};

export const verifyUserCredentials = async (username, password) => {
  const user = await User.findOne({
    username: normalizeUsername(username),
    active: true,
  }).select("+passwordHash");

  return user && passwordMatches(password, user.passwordHash) ? user : null;
};

export const changeUserPassword = async (userId, currentPassword, newPassword) => {
  validatePassword(newPassword);
  const user = await User.findById(userId).select("+passwordHash");

  if (!user || !user.active || !passwordMatches(currentPassword, user.passwordHash)) {
    return false;
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();
  return true;
};

export const changeUserUsername = async (userId, currentPassword, newUsername) => {
  const username = validateUsername(newUsername);
  const user = await User.findById(userId).select("+passwordHash");

  if (!user || !user.active || !passwordMatches(currentPassword, user.passwordHash)) {
    return null;
  }

  user.username = username;
  await user.save();
  return user.username;
};
