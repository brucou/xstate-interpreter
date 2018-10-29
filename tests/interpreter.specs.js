import { Machine } from "xstate"
import { xstateReactInterpreter } from "../src"
import * as QUnit from "qunitjs"
import produce from "immer"

/**
 * Test strategy
 * Specs : FORALL machineConfig, interpreterConfig, FORALL input, f(seq) produces the right outputs
 * That is a lot to test but remember that we do not test the machine itself.
 *
 * Hypothesis :
 * - machineConfig : three relevant categories. One test for each category suffices
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
 * Sooo 3 x 2 x 1 x 3 x 2 x 2 tests = 72 tests!!
 *
 * Hypothesis :
 * - machineConfig independent from the rest of the variables
 *   => max (3, 2 x 1 x 3 x 2 x 2) = 36 tests!
 * - interpreterConfig independent from the rest of the variables, except actionFactoryMap
 *   - so we use 3 machineConfig featuring the three possible actionFactoryMap
 *   => max (3, max (2 , 1 , 3) x 2 x 2) = 12 tests!
 * - input type independent of anything else
 *   => max (3, max (2 , 1 , 3, 2) x 2) = 6 tests!
 * - BUT! testing >1 inputs includes testing 1 inputs on the way
 *   => max (3, max (2 , 1 , 3, 2) x 1) = 3 tests!
 *
 * We can live with that. So here are our tests:
 *
 * 1. (non-hierarchical, immer, mergeOutput, all action strings or none, event as string, >1 inputs)
 * 2. (hierarchical, json patch, mergeOutput, action objects and strings, event as object, >1 inputs)
 * 3. (parallel, immer, mergeOutput, action objects and strings and functions, event as object, >1 inputs)
 * 4. edge case!! actually that one too : no actions!!
 */
QUnit.module("xstateReactInterpreter(Machine, machineConfig, interpreterConfig)", {});

const emptyArray = [];
// cf. http://davidkpiano.github.io/xstate/docs/#/api/config
// NOTE : so it turns that xstate action as string is not a possibility, so only action as object remaining to test
const nonHierarchicalMachine = {
  context: emptyArray,
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: {
          target: 'yellow', // since 4.0
          // specify that 'startYellowTimer' action should be executed
          actions: ['incGreenTimer']
        }
      }
    },
    yellow: {
      onEntry: ['incYellowTimer'],
      on: {
        TIMER: [
          { target: 'red', cond: timer => timer.filter(x => x === 'yellow').length > 1 },
          { target: 'yellow', cond: timer => timer.filter(x => x === 'yellow').length <= 1 },
        ]
      }
    },
    red: {
      on: {
        TIMER: {
          target: 'green',
          actions: ['logGreen']
        }
      }
    },
  }
};
// https://xstate.js.org/docs/#/guides/guards
// TODO: json patch, action objects, event object (done on testing)
// TODO : add action object which does something with eventObj!!
const hierarchicalMachine = {
  id: 'door',
  initial: 'closed',
  states: {
    closed: {
      initial: 'idle',
      states: {
        'idle': {},
        'error': {}
      },
      on: {
        OPEN: [
          { target: 'opened', cond: (extState, eventObj) => extState.isAdmin },
          { target: 'closed.error' }
        ]
      }
    },
    opened: {
      on: {
        CLOSE: 'closed',
      }
    },
  }
};
// cf. http://davidkpiano.github.io/xstate/docs/#/api/config
const parallelMachine = {
  key: 'intersection',
  parallel: true,
  states: {
    northSouthLight: {
      initial: 'green',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    },
    eastWestLight: {
      initial: 'red',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    }
  }
};

const actionFactoryMaps = {
  stringActions: {
    'incYellowTimer': () => (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.push('yellow')},
        outputs: [extendedState, event]
      }
    },
    'incGreenTimer': () => (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.push('green')},
        outputs: [extendedState, event]
      }
    },
    'logGreen': () => (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.pop(), extendedState.pop()},
        outputs: [extendedState, event]
      }
    },
  },
  objectActions: {
    // TODO
  }
};

// DOC : for immer, updates are ONE function, not an array
const immerReducer = function (extendedState, updates) {
  const updateFn = updates;
  return produce(extendedState, updateFn)
};

// DOC : outputs is an array of output = command
const mergeOutputs = function (accOutputs, outputs) {
  return (accOutputs || []).concat(outputs)
};

const reducers = {
  immerReducer: immerReducer,
  jsonpatchReducer: void 0 // TODO
};

const testCases = {
  // NOTE : THAT was tough to check - but precisely gives a good idea
  StandardMachineAndImmerAndStringsActionAndEvents: {
    description: '(non-hierarchical, immer, mergeOutput, all action strings or none, event as string, >1 inputs)',
    machine: nonHierarchicalMachine,
    updateState: reducers.immerReducer,
    actionFactoryMap: actionFactoryMaps.stringActions,
    mergeOutputs,
    inputSequence: ['TIMER', 'TIMER', 'TIMER', 'TIMER', 'TIMER'],
    outputSequence: [
      [[], "TIMER", ["green"], "TIMER"],
      [["green", "yellow"], "TIMER"],
      null,
      [["green", "yellow", "yellow"], "TIMER"],
      [["green",], "TIMER", ["green", "green"], "TIMER"],
    ]
  },
  // TODO
};

QUnit.test("(non-hierarchical, immer, mergeOutput, all action strings, event as string, >1 inputs)", function exec_test(assert) {
  debugger
  const machineConfig = testCases.StandardMachineAndImmerAndStringsActionAndEvents.machine;
  const interpreterConfig = {
    updateState: testCases.StandardMachineAndImmerAndStringsActionAndEvents.updateState,
    mergeOutputs,
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

  assert.ok(nonHierarchicalMachine.context == emptyArray, `immer is indeed immutable library`)
});
