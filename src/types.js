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
