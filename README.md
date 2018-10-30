- [Motivation](#motivation)
- [Example](#example)
- [Install](#install)
- [Tests](#tests)
- [API](#api)
  * [`xstateReactInterpreter(Machine, machineConfig, interpreterConfig)`](#-xstatereactinterpreter-machine--machineconfig--interpreterconfig--)
    + [Description](#description)
    + [Semantics](#semantics)
    + [Contracts](#contracts)
    + [Tips and gotchas](#tips-and-gotchas)

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
- similarly (`xstate` machine library + this interpreter) can be replaced by the native 
`react-state-driven` library, or any other machine interpreter satisfying the required interface
- event handling can be done with the event library of your choice, by writing an adapter for the
 accepted event handling interface (we did that for `rxjs` and `most` so far)
- effect execution being separated out of the machine, it is easy to mock and stub effects for 
testing purposes. This will allow to enjoy the benefits of automated testing without breaking 
glasses. 
- and React aside, we were able to integrate the interpreter with `cyclejs` with no major effort!
 Integration with `Angular2` is in progress but seems to be going the same painless way. After 
 all, the interpreter is just a function!

# Example

```javascript
import { applyPatch } from "json-patch-es6"

// The machine may produce several outputs when transitioning, they have to be merged
const mergeOutputs = function (accOutputs, outputs) {
  return (accOutputs || []).concat(outputs)
};

// The machine produces actions to update its extended state, the reducer executes those actions
const jsonPatchReducer = (extendedState, extendedStateUpdateOperations) => {
  return applyPatch(extendedState, extendedStateUpdateOperations, false, false).newDocument;
};

const actionFactoryMaps = {
  stringActions: {
    'cancelAdmin': (extendedState, event) => {
      return {
        updates: [{ op: 'add', path: '/isAdmin', value: false }],
        outputs: ['admin rights overriden']
      }
    }
  },
};

// xstate machine
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

// Test paraphernalia
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

What happens here :
- the machine starts in the configured initial state with the configured extended state
- we made the following choices for our interpreter :
  - use json patch for immutable state update
  - outputs of the machines are arrays
  - those arrays will be merged by simple concatenation
- we send a `OPEN` input to the machine which triggers :
  - because the guard is satisfied, and there is no actions defined, the machine will move to the  
  `opened` control state, and outputs `null`, which is the value chosen for indicating that there
   is no output.
- we send an object input `{ type: 'CLOSE', overrideAdmin: true }` to the machine :
   - because `overrideAdmin` property is set in the event object, the transition chosen triggers 
   the `cancelAdmin` action, and the entry in the `closed` control state. The `cancelAdmin` 
   action consists of updating the `isAdmin` property of the extended state of the machine to 
   `false`. The machine outputs are `[admin rights overrriden]`. 
- we then send the input `'OPEN'` to the machine : 
  - because the property `isAdmin` is no longer set on the extended state, the machine will 
  transition to the `'closed.error'` control state. On entering that state, the machine will 
  outputs as configured `['Entered .closed.error!', ev]` with `ev` being `"OPEN"` 

In short, we have shown :
- `mergeOutputs` and `updateState` configuration
- how to map action strings to action factories through the mapping object `actionFactoryMap`
- how to directly include action factory in the xstate machine
- action factories produce two pieces of information to the interpreter :
  - how to update the machine's extended state
  - what are the machine outputs

Contrary to other interpreters, the interpreter does not interpret effects. In our React 
integration design, that responsibility is delegated to the command handler. The interpreter 
simply advances the machines, thereby updating the machine state, and producing the machine's 
outputs. The state of the machine is hence completely encapsulated and cannot be accessed from the
 outside. Our interpreter is just a function producing outputs in function of the state of the 
 underlying machine. In our React machine component design, those outputs are commands towards to
  the interfaced systems. 

Another example using `immer` for state update can be found in the `tests` directory.

# Install
`npm xstate-interpreter`

# Tests
`npm run test`

# API
## `xstateReactInterpreter(Machine, machineConfig, interpreterConfig)`
### Description
The factory `xstateReactInterpreter` returns an interpreter with a `yield` function by which 
inputs will be sent to the machine and outputs will be collected.

### Semantics
- the machine is initialized per its configuration and specifications
- the interpreter returns a `yield` function to call the machine with an input
- the machine's actions are *in fine* functions (termed action factories);
  - whose input parameters are the machine's extended state and event
  - which return are :
    - description of the updates to perform on its extended state as a result of the transition
    - the outputs for the state machine as a result of receiving the input
- on transitioning, the machine produces `updates` and `outputs`. The interpreter :
  - perform actual updates on the machine's extended state, according to the `updateState` 
  configured reducer
  - outputs from the machine's triggered action factories are merged with the configured 
  `mergeOutputs` and returned

### Contracts
- `updateState` and `mergeOutput` should be pure, monoidal operations
  - i.e. with an empty value, and associativity properties
- all functions involved in the machine and interpreter configuration should be pure functions
- type contracts

### Tips and gotchas
- `xstate` has automatically configured actions (logs, assign, etc). If you use them you will 
have to define a matching action factory. Our interpreter comes without any predefined action 
factory.
- you can specify xstate actions as strings or functions or objects. I recommend to pick up your 
poison instead of juggling with 3 different types. (Named) Functions are the best option in my 
eyes, provided they do not prevent the machine visualizer from doing its job. 
- the second parameter of the xstate machine factory i.e. `actions` is absorbed into the 
configuration of the interpreter to avoid confusion or duplication
- if the machine does not have any actions configured for an occurring transition, it outputs 
a constant indicating that there is no output (in this version the constant is `null`). The 
machine being a function, always outputs something as a result of being called.


