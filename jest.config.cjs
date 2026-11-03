module.exports = {
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setupAfterEnv.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};