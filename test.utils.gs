// Simple test framework
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachFn = null;
  }

  beforeEach(fn) {
    this.beforeEachFn = fn;
  }

  test(name, fn) {
    this.tests.push({ name, fn, passed: false, error: null });
  }

  async run() {
    console.log(`\nRunning ${this.name}:`);
    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      if (this.beforeEachFn) {
        await this.beforeEachFn();
      }

      try {
        await test.fn();
        test.passed = true;
        console.log(`✓ ${test.name}`);
        passed++;
      } catch (e) {
        test.passed = false;
        test.error = e.message;
        console.log(`✗ ${test.name}`);
        console.log(`  Error: ${e.message}`);
        failed++;
      }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  }
}

// Test helpers
function assertEqualsUtil(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertThrowsUtil(fn, errorType, message) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (e) {
    if (!(e instanceof errorType)) {
      throw new Error(`Expected error of type ${errorType.name} but got ${e.constructor.name}`);
    }
    if (message && e.message !== message) {
      throw new Error(`Expected error message "${message}" but got "${e.message}"`);
    }
  }
}

// Run all test suites
async function runTestSuites(suites) {
  let totalPassed = 0;
  let totalFailed = 0;
  let output = [];

  for (const suite of suites) {
    const results = await suite.run();
    totalPassed += results.passed;
    totalFailed += results.failed;
    
    // Collect output for display
    output.push(`${suite.name}:`);
    suite.tests.forEach(test => {
      output.push(`  ${test.passed ? '✓' : '✗'} ${test.name}`);
      if (test.error) {
        output.push(`    Error: ${test.error}`);
      }
    });
    output.push('');
  }

  output.push(`Total Results: ${totalPassed} passed, ${totalFailed} failed`);
  return {
    output: output.join('\n'),
    passed: totalPassed,
    failed: totalFailed
  };
}

// Export for Node.js environment while maintaining Google Apps Script compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TestSuite,
    assertEquals: assertEqualsUtil,
    assertThrows: assertThrowsUtil,
    runTests: runTestSuites
  };
} 