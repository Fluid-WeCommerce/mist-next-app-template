import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "**/local.db*", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally-unused args prefixed with _.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
