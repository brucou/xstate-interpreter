import produce, { nothing } from "immer"
import { applyPatch } from "json-patch-es6"

export const emptyArray = [];
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
// TODO: json patch, action functions, event object (done on testing)
// TODO : add action object which does something with eventObj!!
export const initialContextHierarchicalMachine = { isAdmin: true };
const hierarchicalMachine = {
  context: initialContextHierarchicalMachine,
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
      // 'OPEN', {CLOSE, overrideAdmin:true}, 'OPEN'}
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
    'incYellowTimer': (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.push('yellow')},
        outputs: [extendedState, event]
      }
    },
    'incGreenTimer': (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.push('green')},
        outputs: [extendedState, event]
      }
    },
    'logGreen': (extendedState, event) => {
      return {
        updates: extendedState => {extendedState.pop(), extendedState.pop()},
        outputs: [extendedState, event]
      }
    },
    'cancelAdmin': (extendedState, event) => {
      return {
        updates: [{ op: 'add', path: '/isAdmin', value: false }],
        outputs: ['admin rights overriden']
      }
    }
  },
};

// DOC : for immer, updates are ONE function, not an array
const immerReducer = function (extendedState, updates) {
  const updateFn = updates;
  return produce(extendedState, updateFn)
};
export const NO_IMMER_UPDATES = nothing;

const jsonPatchReducer = (extendedState, extendedStateUpdateOperations) => {
  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(extendedState, extendedStateUpdateOperations, false, false).newDocument;
};
export const NO_JSON_PATCH_UPDATES = [];

// DOC : outputs is an array of output = command
const mergeOutputs = function (accOutputs, outputs) {
  return (accOutputs || []).concat(outputs)
};

const reducers = {
  immerReducer: immerReducer,
  jsonpatchReducer: jsonPatchReducer
};

export const testCases = {
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
  HierarchicalMachineAndJSONPatchAndFunctionActionsAndObjectEvents: {
    description: '(hierarchical, json patch, mergeOutput, action functions and strings, event as object, >1 inputs)',
    machine: hierarchicalMachine,
    updateState: reducers.jsonpatchReducer,
    actionFactoryMap: actionFactoryMaps.stringActions,
    mergeOutputs,
    inputSequence: ['OPEN', { type: 'CLOSE', overrideAdmin: true }, 'OPEN'],
    outputSequence: [null, ['admin rights overriden'], ["Entered .closed.error!", "OPEN"]]
  },
  // TODO
};
