
import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["node_modules/**", "coverage/**"],
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: globals.node,
        },
        rules: {
            ...js.configs.recommended.rules,
        },
    },
];
