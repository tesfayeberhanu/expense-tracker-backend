import mongoose from "mongoose";

export const DEFAULT_SETTINGS = Object.freeze({
  name: "LP Finance",
  email: "",
  weeklySummary: true,
  transactionAlerts: true,
});

const SettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "dashboard",
      immutable: true,
      unique: true,
    },
    name: {
      type: String,
      default: DEFAULT_SETTINGS.name,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      default: DEFAULT_SETTINGS.email,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Email address is invalid.",
      },
    },
    weeklySummary: {
      type: Boolean,
      default: DEFAULT_SETTINGS.weeklySummary,
    },
    transactionAlerts: {
      type: Boolean,
      default: DEFAULT_SETTINGS.transactionAlerts,
    },
  },
  { timestamps: true },
);

const Settings =
  mongoose.models.DashboardSettings ||
  mongoose.model("DashboardSettings", SettingsSchema);

const publicSettings = (settings) => ({
  name: settings.name,
  email: settings.email,
  weeklySummary: settings.weeklySummary,
  transactionAlerts: settings.transactionAlerts,
});

export const getDashboardSettings = async () => {
  const settings = await Settings.findOneAndUpdate(
    { key: "dashboard" },
    { $setOnInsert: { key: "dashboard", ...DEFAULT_SETTINGS } },
    { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
  ).lean();

  return publicSettings(settings);
};

export const updateDashboardSettings = async (body = {}) => {
  const allowedFields = [
    "name",
    "email",
    "weeklySummary",
    "transactionAlerts",
  ];
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );

  const settings = await Settings.findOneAndUpdate(
    { key: "dashboard" },
    {
      $set: updates,
      $setOnInsert: { key: "dashboard" },
    },
    {
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    },
  ).lean();

  return publicSettings(settings);
};
