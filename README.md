# IMPORTANT
This package is kept for historical reasons but is no longer maintained. You can instead use the [Kingly](https://github.com/brucou/kingly) state machine library which implements the sought-for architecture and patterns. The reasons for the deprecation are:

- The design of `xstate` makes it really hard to build a functional layer on top of it. `xstate` seems to favor non-functional usage as it links itself to the SCXML standard. SCXML goals and design (in particular the choice of XML) reflect the interests of the telecommunications industry at the time of creation (speech processing, multi-modal interactions mostly). SCXML is oriented to process control, and processes can not be manipulated like functions. 
- The cost associated to the `xstate` library (15Kb in some cases) outweighs the benefits. On top of that, adding an interpreting layer that deals with the API surface and complexity of `xstate` compounds the problem. Conversely, the Kingly state machine library compiles an average state machine to below 1 KB JavaScript with zero dependencies. In practice, the extra functionalities proposed by the SCXML-oriented `xstate` (actors, activities, etc.) can be replicated without the coupling and extending the API surface. Cf. Kingly's documentation for examples.
- The interpreter layer is fragile as changes in `xstate` means maintenance tasks on the side of this library. A better design avoids unnecessary dependencies.


# Table of contents
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

# Example 1 : json-patch as state reducer, rxjs for event processing

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

# Image gallery search : immer as state reducer, rxjs for event processing

![image search interface](https://i.imgur.com/mDQQTX8.png?1) 

![machine visualization](https://i.imgur.com/z4hn4Cv.png?1)

```javascript
const xStateRxAdapter = {
  subjectFactory: () => new Rx.Subject(),
  // NOTE : must be bound, because, reasons
  merge: Rx.Observable.merge.bind(Rx.Observable),
  create: fn => Rx.Observable.create(fn)
};

const showXstateMachine = machine => {
  const interpreterConfig = {
    updateState: machine.updateState,
    mergeOutputs: machine.mergeOutputs,
    actionFactoryMap: machine.actionFactoryMap,
  };
  const fsm = xstateReactInterpreter(xstateMachineFactory, machine.config, interpreterConfig);

  return React.createElement(Machine, {
    eventHandler: xStateRxAdapter,
    preprocessor: machine.preprocessor,
    fsm: fsm,
    commandHandlers: machine.commandHandlers,
    componentWillUpdate: (machine.componentWillUpdate || noop)(machine.inject),
    componentDidUpdate: (machine.componentDidUpdate || noop)(machine.inject)
  }, null)
};

// Displays all machines (not very beautifully, but this is just for testing)
ReactDOM.render(
  div([
    showXstateMachine(xstateMachines.xstateImageGallery)
  ]),
  document.getElementById('root')
);

export const NO_IMMER_UPDATES = nothing;
export const immerReducer = function (extendedState, updates) {
  if (updates === NO_IMMER_UPDATES) return extendedState
  const updateFn = updates;
  return produce(extendedState, updateFn)
};

export const mergeOutputs = function (accOutputs, outputs) {
  return (accOutputs || []).concat(outputs || [])
};

export const xstateMachines = {
  xstateImageGallery: {
    preprocessor: rawEventSource => rawEventSource
      .startWith([INIT_EVENT])
      .map(ev => {
        const { rawEventName, rawEventData: e, ref } = destructureEvent(ev);

        if (rawEventName === INIT_EVENT) {
          return { type: INIT_EVENT, data : void 0}
        }
        // Form raw events
        else if (rawEventName === 'onSubmit') {
          e.persist();
          e.preventDefault();
          return { type: 'SEARCH', data: ref.current.value }
        }
        else if (rawEventName === 'onCancelClick') {
          return { type: 'CANCEL_SEARCH', data: void 0 }
        }
        // Gallery
        else if (rawEventName === 'onGalleryClick') {
          const item = e;
          return { type: 'SELECT_PHOTO', data: item }
        }
        // Photo detail
        else if (rawEventName === 'onPhotoClick') {
          return { type: 'EXIT_PHOTO', data: void 0 }
        }
        // System events
        else if (rawEventName === 'SEARCH_SUCCESS') {
          const items = e;
          return { type: 'SEARCH_SUCCESS', data: items }
        }
        else if (rawEventName === 'SEARCH_FAILURE') {
          return { type: 'SEARCH_FAILURE', data: void 0 }
        }

        return NO_INTENT
      })
      .filter(x => x !== NO_INTENT)
    ,
    // DOC : we kept the same machine but :
    // - added the render actions
    // - render must go last, in order to get the updated extended state
    // - added an init event to trigger an entry on the initial state
    config: {
      context: { query: '', items: [], photo: undefined, gallery: '' },
      initial: 'init',
      states: {
        init: {
          on: { [INIT_EVENT]: 'start' }
        },
        start: {
          onEntry: [renderGalleryAppImmer('start')],
          on: { SEARCH: 'loading' }
        },
        loading: {
          onEntry: ['search', renderGalleryAppImmer('loading')],
          on: {
            SEARCH_SUCCESS: { target: 'gallery', actions: ['updateItems'] },
            SEARCH_FAILURE: 'error',
            CANCEL_SEARCH: 'gallery'
          }
        },
        error: {
          onEntry: [renderGalleryAppImmer('error')],
          on: { SEARCH: 'loading' }
        },
        gallery: {
          onEntry: [renderGalleryAppImmer('gallery')],
          on: {
            SEARCH: 'loading',
            SELECT_PHOTO: 'photo'
          }
        },
        photo: {
          onEntry: ['setPhoto', renderGalleryAppImmer('photo')],
          on: { EXIT_PHOTO: 'gallery' }
        }
      }
    },
    actionFactoryMap: {
      'search': (extendedState, { data: query }, xstateAction) => {
        const searchCommand = { command: COMMAND_SEARCH, params: query };

        return {
          outputs: [searchCommand],
          updates: nothing
        }
      },
      'updateItems': (extendedState, { data: items }, xstateAction) => {
        return {
          updates: extendedState => {extendedState.items = items},
          outputs: NO_OUTPUT
        }
      },
      'setPhoto': (extendedState, { data: item }, xstateAction) => {
        return {
          updates: extendedState => {extendedState.photo = item},
          outputs: NO_OUTPUT
        }
      }
    },
    updateState: immerReducer,
    mergeOutputs: mergeOutputs,
    commandHandlers: {
      [COMMAND_SEARCH]: (trigger, query) => {
        runSearchQuery(query)
          .then(data => {
            trigger('SEARCH_SUCCESS')(data.items)
          })
          .catch(error => {
            trigger('SEARCH_FAILURE')(void 0)
          });
      }
    },
    inject: new Flipping(),
    componentWillUpdate: flipping => (machineComponent, prevProps, prevState, snapshot, settings) => {flipping.read();},
    componentDidUpdate: flipping => (machineComponent, nextProps, nextState, settings) => {flipping.flip();}
  }
```

# Install
`npm xstate-interpreter`

# Tests
`npm run test`

# API
## `xstateReactInterpreter(Machine, machineConfig, interpreterConfig)`
### Description
The factory `xstateReactInterpreter` returns an interpreter with a `yield` function by which 
inputs will be sent to the machine and outputs will be collected. It also returns an instance of 
the executable state machine.

### Semantics
- the machine is initialized per its configuration and specifications
- the interpreter returns a `yield` function to call the machine with an input
- the machine's actions are *in fine* functions (termed action factories);
  - whose input parameters are the machine's extended state and event
  - which return :
    - a description of the updates to perform on its extended state as a result of the transition
    - the outputs for the state machine as a result of receiving the input
- on transitioning, the machine produces `updates` and `outputs`. The interpreter :
  - perform actual updates on the machine's extended state, according to the `updateState` 
  configured reducer
  - outputs from the machine's triggered action factories are merged with the configured 
  `mergeOutputs` and returned

### Types
JSDoc types available is `/src/types` :

```javascript

/**
 * @typedef {function(ExtendedState, ExtendedStateUpdate): ExtendedState} ExtendedStateReducer
 */
/**
 * @typedef {*} Output
 */
/**
 * @typedef {Container<Output>} Outputs
 * `Container` is a foldable functor, for instance `Array`
 */
/**
 * @typedef {function(Outputs, Outputs): Outputs} OutputReducer
 */
/**
 * @typedef {String} xStateActionType
 * The type of xstate action. In xstate v4.0, this is the property `type` of the xstate action
 */
/**
 * @typedef {*} xStateEvent
 * cf. xState types. Usually either a string or an object with a `type` property which is a string
 */
/**
 * @typedef {*} xstateAction
 * cf. xState types. Usually an object with at least a `type` and `exec` property
 * The exec property when set (i.e. truthy) holds an action factory function.
 * The `type` property when set holds an identifier used to map to an action factory
 */
/**
 * @typedef {function(ExtendedState, xStateEvent, xstateAction):x} xStateActionFactory
 * The type of xstate action. In xstate v4.0, this is the property `type` of the xstate action
 */
/**
 * @typedef {Object} interpreterConfig
 * @property {ExtendedStateReducer} updateState
 * @property {OutputReducer} mergeOutputs
 * @property {Object.<xStateActionType, xStateActionFactory>} actionFactoryMap
 */
```

### Contracts
- `updateState` and `mergeOutput` should be pure, monoidal operations
  - i.e. with an empty value, and associativity properties
- all functions involved in the machine and interpreter configuration should be pure functions
- if you use a function as xstate action, that function must be a named function!!
- type contracts
- integrating `xstate-interpreter` with `react-state-driven` means that the xstate machine will 
receive an init event. This means a dummy initial state and an init transition should be configured 
towards the real initial state of the machine. Alternaively, the machine can be configured to 
simply ignore unaccepted events. In any case, the xstate machine cannot reuse the reserved 
initial event.

### Tips, gotchas and limitations
- activities and delays are not currently interpreted
- `xstate` has automatically configured actions (logs, assign, invoke, etc). If you use them you 
will have to define a matching action factory. Our interpreter comes without any predefined action 
factory.
- you can specify xstate actions as strings or functions or objects. I recommend to pick up your 
poison instead of juggling with 3 different types. (Named) Functions are the best option in my 
eyes, provided they do not prevent the machine visualizer from doing its job. 
- the second parameter of the xstate machine factory i.e. `actions` is absorbed into the 
configuration of the interpreter to avoid confusion or duplication
- if the machine does not have any actions configured for an occurring transition, it outputs 
a constant indicating that there is no output (in this version the constant is `null`). The 
machine being a function, always outputs something as a result of being called.
