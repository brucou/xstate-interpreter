# Motivation
The [xstate](https://github.com/davidkpiano/xstate) statecharts library has a few interpreters 
already available with miscelleanous  design goals. In order to integrate `xstate` with React 
through our [`react-state-driven`](https://github.com/brucou/react-state-driven) 
component, we needed to adapt the xstate interface to the interface for our `Machine` component. 

This is so because our component achieves a decoupling of the state machine on one side, and the 
React component on the other side, but also separates out the event handling, state 
representation and effect execution concerns out of the library. The usual technique of 
**programming to an interface instead of to an implementation** is used to that purpose, which in
 turn means that the external concerns have to abide by the interface set by the `Machine` component.

It turns out that we could not reuse the default interpreter and other existing 
interpreters for `xstate` as they do not synchronously return the list of computed actions in 
response to an input (listeners are instead used). Additionally some interpreters may also 
produce effects which in our design is forbidden. As a result we created an interpreter which :

- matches the required interface to integrate xstate in React through our `Machine` component
- computes and returns a list of actions in response to an input
- does not produce any effects

The benefits are the following :
- we were able to use `json patch` and `immer` for the state representation concern. `Immutable.js` 
could also be used via simple interface adaptation. If that is your use case, you may even 
interface a reducer which updates state in place. How you update state is not a concern of the 
`Machine` component
- similarly `xstate` interpreter can be replaced by the native `react-state-driven` interpreter, 
or any other machine interpreter
- event handling can be done with the event library of your choice, by writing an adapter for the
 accepted event handling interface
- effect execution being separated out of the machine, it is easy to mock and stub effects for 
testing purposes. This will allow to enjoy the benefits of automated testing without breaking 
glasses. 

# Example

```javascript
import { applyPatch } from "json-patch-es6"
import produce, { nothing } from "immer"

const jsonPatchReducer = (extendedState, extendedStateUpdateOperations) => {
  return applyPatch(extendedState, extendedStateUpdateOperations, false, false).newDocument;
};

// DOC : for immer, updates are ONE function, not an array
const immerReducer = function (extendedState, updates) {
  const updateFn = updates;
  return produce(extendedState, updateFn)
};
export const NO_IMMER_UPDATES = nothing;

const hierarchicalMachine = {
  context: { isAdmin: true },
  id: 'door',
  initial: 'closed',
  states: {
    closed: {
      initial: 'idle',
      states: {
        'idle': {},
        'error': {
          onEntry: function logMessage(extS, ev) {return { updates: [], outputs: ['Entered .closed.error!', ev] }}
        }
      },
      // NOTE : test input sequence : ['OPEN', {'CLOSE', overrideAdmin:true}, 'OPEN']
      on: {
        OPEN: [
          { target: 'opened', cond: (extState, eventObj) => extState.isAdmin },
          { target: 'closed.error' }
        ]
      }
    },
    opened: {
      on: {
        CLOSE: [
          { target: 'closed', cond: (extState, eventObj) => eventObj.overrideAdmin, actions: ['cancelAdmin'] },
          { target: 'closed', cond: (extState, eventObj) => !eventObj.overrideAdmin }
        ]
      }
    },
  }
};

export const testCases = {
  HierarchicalMachineAndJSONPatchAndFunctionActionsAndObjectEvents: {
    description: '(hierarchical, json patch, mergeOutput, action functions and strings, event as object, >1 inputs)',
    machine: hierarchicalMachine,
    updateState: reducers.jsonpatchReducer,
    actionFactoryMap: actionFactoryMaps.stringActions,
    mergeOutputs,
    inputSequence: ['OPEN', { type: 'CLOSE', overrideAdmin: true }, 'OPEN'],
    outputSequence: [null, ['admin rights overriden'], ["Entered .closed.error!", "OPEN"]]
  },
}

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
```

# Install
`npm xstate-interpreter`

# Tests
`npm run test`

# API
## `xstateReactInterpreter(Machine, machineConfig, interpreterConfig)`
### Description
The factory `xstateReactInterpreter` returns an interpreter which consists of two functions 
`yield` and `start`, `start` being simple sugar for `yield(INIT_EVENT)`. Note that the `start` 
function exists only to comply with the required interface. With our `xstate` interpreter, there 
is no need to start with an initial event. The machine is configured and automatically goes to its 
 initial state. You can thus the interpreter `yield` function directly out of the box.

### Semantics

### Contracts
Best don't use assign - this is already taken care of by the interpreter
However it still might work : to test !

### Examples



