#! /usr/bin/env node

const { Command } = require('commander');
const program = new Command();

let targetURL;
let timeout = 300000;
program.option('--browser <string>') .argument('<url>') .argument('[timeout]') .action((url, arg_timeout) => {targetURL = url; if (arg_timeout) { timeout = parseInt(arg_timeout); }});
program.parse(process.argv);

const options = program.opts();
//const args = program.args.slice(0);
//
//if (args.length < 1 || args.length > 2) {
  //console.log("Usage: node run-qunit-chrome.js <URL> <timeout>");
  //process.exit(1);
//}

/*
 *
 *
 * I got the following error with ".browser = firefox"
 * instead of with ".product = firefox"

qunit-puppeteer --browser "firefox" "http://127.0.0.1:2400/fc-solve-staging/js-fc-solve/automated-tests/"
Error: Could not find Firefox (rev. stable_133.0.3). This can occur if either
 1. you did not perform an installation for Firefox before running the script (e.g. `npx puppeteer browsers install firefox`) or
 2. your cache path is incorrectly configured (which is: /home/shlomif/.cache/puppeteer).
For (2), check out our guide on configuring puppeteer at https://pptr.dev/guides/configuration.
    at FirefoxLauncher.resolveExecutablePath (/home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml/node_modules/qunit-puppeteer/node_modules/puppeteer-core/lib/cjs/puppeteer/node/BrowserLauncher.js:307:27)
    at FirefoxLauncher.executablePath (/home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml/node_modules/qunit-puppeteer/node_modules/puppeteer-core/lib/cjs/puppeteer/node/FirefoxLauncher.js:157:21)
    at FirefoxLauncher.computeLaunchArguments (/home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml/node_modules/qunit-puppeteer/node_modules/puppeteer-core/lib/cjs/puppeteer/node/FirefoxLauncher.js:111:38)
    at async FirefoxLauncher.launch (/home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml/node_modules/qunit-puppeteer/node_modules/puppeteer-core/lib/cjs/puppeteer/node/BrowserLauncher.js:81:28)
    at async /home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml/node_modules/qunit-puppeteer/bin/qunit-puppeteer.js:27:19
gmake[1]: *** [lib/make/main.mak:475: browser-tests] Error 1
gmake[1]: Leaving directory '/home/shlomif/progs/freecell/git/fc-solve/fc-solve/site/wml'
gmake: *** [lib/make/main.mak:487: smoke-tests] Error 2

 * */

const browser_args = { headless: "new" };
if (options.browser) {
//    browser_args.browser = options.browser;
    browser_args.product = options.browser;
}

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch(browser_args);
  const page = await browser.newPage();

  // Attach to browser console log events, and log to node console
  await page.on('console', (...params) => {
    for (let i = 0; i < params.length; ++i)
      console.log(`${params[i]}`);
  });

  var moduleErrors = [];
  var testErrors = [];
  var assertionErrors = [];

  await page.exposeFunction('harness_moduleDone', context => {
    if (context.failed) {
      var msg = "Module Failed: " + context.name + "\n" + testErrors.join("\n");
      moduleErrors.push(msg);
      testErrors = [];
    }
  });

  await page.exposeFunction('harness_testDone', context => {
    if (context.failed) {
      var msg = "  Test Failed: " + context.name + assertionErrors.join("    ");
      testErrors.push(msg);
      assertionErrors = [];
      process.stdout.write("F");
    } else {
      process.stdout.write(".");
    }
  });

  await page.exposeFunction('harness_log', context => {
    if (context.result) { return; } // If success don't log

    var msg = "\n    Assertion Failed:";
    if (context.message) {
      msg += " " + context.message;
    }

    if (context.expected) {
      msg += "\n      Expected: " + context.expected + ", Actual: " + context.actual;
    }

    assertionErrors.push(msg);
  });

  await page.exposeFunction('harness_done', context => {
    console.log("\n");

    if (moduleErrors.length > 0) {
      for (var idx=0; idx<moduleErrors.length; idx++) {
        console.error(moduleErrors[idx]+"\n");
      }
    }

    var stats = [
      "Time: " + context.runtime + "ms",
      "Total: " + context.total,
      "Passed: " + context.passed,
      "Failed: " + context.failed
    ];
    console.log(stats.join(", "));
    
    browser.close();
    if (context.failed > 0){
      process.exit(1);
    }else{
      process.exit();
    }
  });

  await page.goto(targetURL);

  await page.evaluate(() => {
    QUnit.config.testTimeout = 10000;

    // Cannot pass the window.harness_blah methods directly, because they are
    // automatically defined as async methods, which QUnit does not support
    QUnit.moduleDone((context) => { window.harness_moduleDone(context); });
    QUnit.testDone((context) => { window.harness_testDone(context); });
    QUnit.log((context) => { window.harness_log(context); });
    QUnit.done((context) => { window.harness_done(context); });

    console.log("\nRunning: " + JSON.stringify(QUnit.urlParams) + "\n");
  });

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  await wait(timeout);

  console.error("Tests timed out");
  browser.close();
  process.exit(124);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
