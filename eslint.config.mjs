import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-img-element": "off", // immagini private servite da API autenticate: next/image non serve
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-*/**",
      "e2e-screens/**",
      "ecosystem.config.cjs",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/tesseract/**",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
