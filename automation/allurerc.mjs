// Allure 3 report config. `npm run allure:generate` builds ./allure-report from ./allure-results.
// historyPath is how the trend charts work: each run appends one data point, and CI keeps the file
// between runs by publishing it next to the report (see .github/workflows/e2e.yml).
export default {
  name: 'Astronomy Shop: API + UI automation',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  appendHistory: true,
  plugins: {
    awesome: {
      options: {
        reportName: 'Astronomy Shop: API + UI automation',
        singleFile: false,
        // API and UI first, then the spec file, then the test case (TC-...) that the describe block is named after.
        groupBy: ['parentSuite', 'suite', 'subSuite'],
        reportLanguage: 'en',
      },
    },
  },
};
