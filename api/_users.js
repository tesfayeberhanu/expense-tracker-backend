import crypto from "node:crypto";
import mongoose from "mongoose";

const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 256;
const MINIMUM_USERNAME_LENGTH = 2;
const MAXIMUM_USERNAME_LENGTH = 120;
const SCRYPT_KEY_LENGTH = 64;

export const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
};

export const PERMISSIONS = [
  "operators:manage",
  "transactions:create",
  "transactions:read",
  "transactions:read_all",
  "transactions:update",
  "transactions:delete",
  "reports:view",
  "reports:view_all",
  "settings:read",
  "settings:update",
  "configuration:read",
];

export const DEFAULT_OPERATOR_PERMISSIONS = [
  "transactions:create",
  "transactions:read",
  "reports:view",
  "settings:read",
  "configuration:read",
];

const ADMIN_PERMISSIONS = [...PERMISSIONS];
const PERMISSION_SET = new Set(PERMISSIONS);

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
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.OPERATOR,
      index: true,
    },
    permissions: {
      type: [String],
      enum: PERMISSIONS,
      default: DEFAULT_OPERATOR_PERMISSIONS,
    },
  },
  { timestamps: true, versionKey: false },
);

export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

const normalizeUsername = (username) => String(username ?? "").trim().toLowerCase();

export const normalizePermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    throw new Error("Permissions must be an array.");
  }

  return [...new Set(permissions.map((permission) => String(permission).trim()))]
    .filter(Boolean)
    .map((permission) => {
      if (!PERMISSION_SET.has(permission)) {
        throw new Error(`Unsupported permission: ${permission}`);
      }
      return permission;
    });
};

export const publicUser = (user) => {
  if (!user) return null;
  const role = user.role || ROLES.OPERATOR;
  return {
    id: String(user._id || user.id),
    username: user.username,
    role,
    permissions: role === ROLES.ADMIN ? ADMIN_PERMISSIONS : user.permissions || [],
    active: user.active !== false,
  };
};

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

export const hasPermission = (user, permission) =>
  isAdmin(user) || Boolean(user?.permissions?.includes(permission));

export const hasAnyPermission = (user, permissions = []) =>
  isAdmin(user) || permissions.some((permission) => hasPermission(user, permission));

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
  if (existingUser) {
    existingUser.role = ROLES.ADMIN;
    existingUser.permissions = ADMIN_PERMISSIONS;
    existingUser.active = true;
    await existingUser.save();
    return;
  }

  if (replaceUsername && replaceUsername !== username) {
    validateUsername(replaceUsername);
    const replacementUser = await User.findOne({ username: replaceUsername });
    if (replacementUser) {
      replacementUser.username = username;
      replacementUser.passwordHash = hashPassword(password);
      replacementUser.active = true;
      replacementUser.role = ROLES.ADMIN;
      replacementUser.permissions = ADMIN_PERMISSIONS;
      await replacementUser.save();
      return;
    }
  }

  try {
    await User.create({
      username,
      passwordHash: hashPassword(password),
      role: ROLES.ADMIN,
      permissions: ADMIN_PERMISSIONS,
    });
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

export const listOperators = async () => {
  const operators = await User.find({ role: ROLES.OPERATOR })
    .sort({ username: 1 })
    .lean();
  return operators.map(publicUser);
};

export const createOperator = async (body = {}) => {
  const username = validateUsername(body.username);
  validatePassword(body.password);
  const permissions = body.permissions
    ? normalizePermissions(body.permissions)
    : DEFAULT_OPERATOR_PERMISSIONS;

  const operator = await User.create({
    username,
    passwordHash: hashPassword(body.password),
    role: ROLES.OPERATOR,
    permissions,
    active: body.active !== false,
  });

  return publicUser(operator);
};

export const updateOperator = async (operatorId, body = {}) => {
  const operator = await User.findOne({
    _id: operatorId,
    role: ROLES.OPERATOR,
  }).select("+passwordHash");

  if (!operator) return null;

  if (body.username !== undefined) {
    operator.username = validateUsername(body.username);
  }

  if (body.password !== undefined && body.password !== "") {
    operator.passwordHash = hashPassword(body.password);
  }

  if (body.permissions !== undefined) {
    operator.permissions = normalizePermissions(body.permissions);
  }

  if (body.active !== undefined) {
    operator.active = Boolean(body.active);
  }

  await operator.save();
  return publicUser(operator);
};

export const deactivateOperator = async (operatorId) => {
  const operator = await User.findOneAndUpdate(
    { _id: operatorId, role: ROLES.OPERATOR },
    { active: false },
    { new: true },
  ).lean();
  return publicUser(operator);
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
