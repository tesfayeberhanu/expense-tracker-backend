import mongoose from "mongoose";

export const DEFAULT_CONFIGURATION = Object.freeze({
  pipelines: [
    "Cash",
    "Lite",
    "Habesha",
    "Best",
    "Speed",
    "Santim",
    "Dash",
    "Dama",
  ],
  currencies: ["ETB", "USD", "USDT"],
});

const ConfigurationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "dashboard",
      immutable: true,
      unique: true,
    },
    pipelines: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: DEFAULT_CONFIGURATION.pipelines,
      validate: {
        validator: (values) =>
          values.length > 0 && new Set(values).size === values.length,
        message: "Pipelines must contain unique values.",
      },
    },
    currencies: {
      type: [
        {
          type: String,
          enum: DEFAULT_CONFIGURATION.currencies,
        },
      ],
      default: DEFAULT_CONFIGURATION.currencies,
      validate: {
        validator: (values) =>
          values.length > 0 && new Set(values).size === values.length,
        message: "Currencies must contain unique values.",
      },
    },
  },
  { timestamps: true, versionKey: false },
);

const Configuration =
  mongoose.models.DashboardConfiguration ||
  mongoose.model("DashboardConfiguration", ConfigurationSchema);

const publicConfiguration = (configuration) => ({
  pipelines: configuration.pipelines,
  currencies: configuration.currencies,
});

export const getDashboardConfiguration = async () => {
  const configuration = await Configuration.findOneAndUpdate(
    { key: "dashboard" },
    { $setOnInsert: { key: "dashboard", ...DEFAULT_CONFIGURATION } },
    { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
  ).lean();

  return publicConfiguration(configuration);
};
