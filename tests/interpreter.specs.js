import { Machine } from "xstate"
import { xstateReactInterpreter } from "../src"
import * as QUnit from "qunitjs"
import { emptyArray, initialContextHierarchicalMachine, testCases } from "../fixtures"

/**
 * Test strategy
 * Specs : FORALL machineConfig, interpreterConfig, FORALL input, f(seq) produces the right outputs
 * That is a lot to test but remember that we do not test the machine itself.
 *
 * Hypothesis :
 * - machineConfig : already tested so it does not really matter, but there are three interesting cases
 *   - non-hierarchical machines
 *   - hierarchical machines, no parallel states
 *   - hierarchical machines, with parallel states
 * - interpreterConfig :
 *   - updateState : two different updating mechanism should suffice
 *     - immer
 *     - json patch
 *   - mergeOutputs : one should suffice
 *   - actionFactoryMap : three should suffice
 *     - xstate action as string
 *     - xstate action as object
 *     - xstate action as function
 *  - input : two kinds of inputs x [1 input, >1 inputs]
 *    - xstate event as string
 *    - xstate event as object
 *
 * Sooo 1 x 2 x 1 x 3 x 2 x 2) tests = 24 tests!!
 *
 * Hypothesis :
 * - interpreterConfig independent from the rest of the variables, except actionFactoryMap
 *   - so we use 3 machineConfig featuring the three possible actionFactoryMap
 *   => 1 x max (2 , 1 , 3) x 2 x 2) = 12 tests!
 * - input type independent of anything else
 *   => 1 x max (2 , 1 , 3, 2) x 2) = 6 tests!
 * - BUT! testing >1 inputs includes testing 1 inputs on the way
 *   => 1 x max (2 , 1 , 3, 2) x 1) = 3 tests!
 *
 * We can live with that. So here are our tests:
 *
 * 1. (non-hierarchical, immer, mergeOutput, all action strings or none, event as string, >1 inputs)
 * 2. (hierarchical, json patch, mergeOutput, ~action objects~ and strings, event as object, >1 inputs)
 * 3. (parallel, immer, mergeOutput, ~action objects~ and strings and functions, event as object, >1 inputs)
 * 4. edge case!! actually that one too : no actions!!
 *
 * So it turns out we will only do two tests:
 * - there are only two disjunctives for xstate action : .exec undefined or not
 * - we tested the case of transition without action while testing the other cases
 */
QUnit.module("xstateReactInterpreter(Machine, machineConfig, interpreterConfig)", {});

QUnit.test("(non-hierarchical, immer, mergeOutput, all action strings, event as string, >1 inputs)", function exec_test(assert) {
  const machineConfig = testCases.StandardMachineAndImmerAndStringsActionAndEvents.machine;
  const interpreterConfig = {
    updateState: testCases.StandardMachineAndImmerAndStringsActionAndEvents.updateState,
    mergeOutputs: testCases.StandardMachineAndImmerAndStringsActionAndEvents.mergeOutputs,
    actionFactoryMap: testCases.StandardMachineAndImmerAndStringsActionAndEvents.actionFactoryMap,
  };

  const interpreter = xstateReactInterpreter(Machine, machineConfig, interpreterConfig);
  const testScenario = testCases.StandardMachineAndImmerAndStringsActionAndEvents.inputSequence;
  const actualTestResults = testScenario.map(interpreter.yield);
  const expectedTestResults = testCases.StandardMachineAndImmerAndStringsActionAndEvents.outputSequence;

  testScenario.forEach((input, index) => {
    assert.deepEqual(
      actualTestResults[index],
      expectedTestResults[index],
      testCases.StandardMachineAndImmerAndStringsActionAndEvents.description
    );
  });

  assert.ok(
    testCases.StandardMachineAndImmerAndStringsActionAndEvents.machine.context === emptyArray,
    `immer is indeed immutable library`
  );
});

QUnit.test("(hierarchical, json patch, mergeOutput, action functions and strings, event as object, >1 inputs)", function exec_test(assert) {
  const testCase = testCases.HierarchicalMachineAndJSONPatchAndFunctionActionsAndObjectEvents;
  const machineConfig = testCase.machine;
  const interpreterConfig = {
    updateState: testCase.updateState,
    mergeOutputs: testCase.mergeOutputs,
    actionFactoryMap: testCase.actionFactoryMap,
  };

  const interpreter = xstateReactInterpreter(Machine, machineConfig, interpreterConfig);
  const testScenario = testCase.inputSequence;
  const actualTestResults = testScenario.map(interpreter.yield);
  const expectedTestResults = testCase.outputSequence;

  testScenario.forEach((input, index) => {
    assert.deepEqual(
      actualTestResults[index],
      expectedTestResults[index],
      testCase.description
    );
  });

  assert.ok(testCase.machine.context === initialContextHierarchicalMachine, `json patch does not mutate state in place`);
});
