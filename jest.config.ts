import type { Config } from "jest";

const config: Config = {
  clearMocks: true,
  coverageProvider: "v8",
  moduleNameMapper: {
    "^@/lib/generated/prisma/client$": "<rootDir>/tests/unit/__mocks__/prisma-client.ts",
    "^server-only$": "<rootDir>/tests/unit/__mocks__/server-only.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
  passWithNoTests: false,
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
};

export default config;
