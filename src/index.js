import { INIT_EVENT, NO_OUTPUT } from "state-transducer"

// Helpers
function actionTypeContract(actionType) {
  return actionType === 'string' || actionType === 'object' || actionType === 'function'
}

function assertActionType(xstateAction) {
  if (!actionTypeContract(typeof xstateAction)) throw new Error(`xstateBridge > yyield > assertActionType : action must be either a function, a string or an object!`)
  return true
}

function actionFactoryFromXstateAction(xstateAction, actionFactoryMap) {
  let actionFactory = void 0;

  switch (typeof xstateAction.exec) {
    case 'function' :
      actionFactory = xstateAction.exec;
      break;
    // NOTE: never happens even though in the config, action is a string
    // case 'string':
    //   actionFactory = xstateAction in actionFactoryMap && actionFactoryMap[xstateAction];
    //   break;
    case 'undefined':
      // NOTE : have to do this even if it makes it heavier, because there might be other data in xstateAction
      actionFactory = xstateAction.type in actionFactoryMap && actionFactoryMap[xstateAction.type]
      break;
    default:
      // We should never get there, we allegedly checked types already
      throw new Error(`actionFactoryFromXstateAction : mmm unexpected type for action!`)
  }

  if (!actionFactory) throw new Error(`actionFactoryFromXstateAction : could not find action factory for action!`)

  return actionFactory
}

export function xstateReactInterpreter(Machine, machineConfig, interpreterConfig) {
// Contracts
  // - cannot produce effects
  // - state reducer must be configurable
  // - actionFactory must return the required type {command, params}
  // - actionFactoryMap must be configured

  const { updateState, mergeOutputs, actionFactoryMap } = interpreterConfig;
  const xMachine = Machine(machineConfig);
  // Load the initial state of the machine
  let controlState = xMachine.initialState;
  let extendedState = machineConfig.context;

  // can't name that function yield, it is a reserved keyword
  function yyield(event) {

    const nextControlState = xMachine.transition(controlState, event, extendedState);
    const { actions: actionFactories } = nextControlState;

    const { accExtendedState, accOutputs } = actionFactories.reduce((acc, xstateAction) => {
      assertActionType(xstateAction);
      const actionFactory = actionFactoryFromXstateAction(xstateAction, actionFactoryMap);

      let { accExtendedState, accOutputs } = acc;

      const actions = actionFactory(accExtendedState, event, xstateAction);
      // NOTE : `updates` holds the changes to the extended state, `outputs` what to return
      const { updates, outputs } = actions;

      return {
        accOutputs: mergeOutputs(accOutputs, outputs),
        accExtendedState: updateState(accExtendedState, updates)
      }
    }, { accExtendedState: extendedState, accOutputs: NO_OUTPUT });

    // Update interpreter state
    controlState = nextControlState;
    extendedState = accExtendedState;

    return accOutputs
  }

  return {
    start: () => yyield({ [INIT_EVENT]: void 0 }),
    yield: yyield,
    machine: xMachine // started machine - we cannot stop it but it is ok because we won't use listeners
  }
}
