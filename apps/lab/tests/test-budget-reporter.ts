import type { FullConfig, Reporter, Suite } from '@playwright/test/reporter'

const CONTRACT_LAB_TEST_CAP = 40

export default class ContractLabTestBudgetReporter implements Reporter {
  onBegin(_config: FullConfig, suite: Suite) {
    const testCount = suite.allTests().length
    if (testCount > CONTRACT_LAB_TEST_CAP) {
      throw new Error(
        `Contract Lab browser suite has ${testCount} tests; the explicit cap is ${CONTRACT_LAB_TEST_CAP}.`,
      )
    }
  }
}
